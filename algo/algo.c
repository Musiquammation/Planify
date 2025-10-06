#include "algo.h"

#include "Task.h"
#include "Slot.h"
#include "shared.h"

#include "Array.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>


data_t data;


int* compareOptions_scores;

int compareOptions(const void* a, const void* b) {
	int s1 = compareOptions_scores[*(int*)a];
	int s2 = compareOptions_scores[*(int*)b];
	if (s2 > s1) return 1;
	if (s2 < s1) return -1;

	if (a < b) return -1;
	if (a > b) return 1;
	return 0;
}

Layer* newLayers(void) {
	Layer* layers = malloc(sizeof(Layer) * shared.slots_len);
	for (int s = 0; s < shared.slots_len; s++) {
		int* options = malloc(sizeof(int) * shared.tasks_len);
		int* scores = malloc(sizeof(int) * shared.tasks_len);
		
		int duration = shared.slots[s].duration;

		// Fill options
		int count = 0;
		for (int t = 0; t < shared.tasks_len; t++) {
			love_t love = shared.slots[s].loveTable[shared.tasks[t].type];
			if (love > 250)
				continue;
			
			int taskDuration = shared.tasks[t].duration;
			if (taskDuration > duration)
				continue;
			
			options[count] = t;
			
			int taskScore = taskDuration * love * shared.tasks[t].level;
			scores[t] = taskScore;
			
			count++;
		}

		compareOptions_scores = scores;
		qsort(options, count, sizeof(int), compareOptions);


		if (count < shared.tasks_len) {
			options[count] = -1; // finish
		}
		

		Layer* layer = &layers[s];
		layer->options = options;
		layer->scores = scores;
		layer->score = 0;
		layer->fullDuration = duration;
	}

	return layers;
}

void freeLayers(Layer* layers) {
	Array_for(Layer,  layers, shared.slots_len, l) {
		free(l->options);
		free(l->scores);
	}
	free(layers);
}




int pushLayers(int* usages, const int* ownerUsage, int* layerDurations) {

	Array* conflictLayers = malloc(shared.tasks_len * sizeof(Array)); // types: int to layer
	Array conflictTasks; // type: int
	Array_create(&conflictTasks, sizeof(int));

	int scoreBase = 0;

	for (int layerIndex = 0; layerIndex < shared.slots_len; layerIndex++) {
		Layer* layer = &data.layers[layerIndex];

		// Fill taken units and usageList
		int leftDuration = layerDurations[layerIndex];
		int realLeftDuration = leftDuration;
		int* const options = layer->options;
		Array_for(int, layer->options, shared.tasks_len, optPtr) {
			int t = *optPtr;
			if (t == -1)
				break; // end
			
			int optDuration = data.units[t].duration;
			if (optDuration > leftDuration)
				continue;
			
				
			int usage = usages[t];

			if (usage == AVAILABLE) {
				// Consume task
				realLeftDuration -= optDuration;
				usages[t] = layerIndex;
				scoreBase += layer->scores[t];
				
			} else if (usage >= 0) {
				if (ownerUsage[t] != AVAILABLE)
					continue;

				// Create conflict
				scoreBase -= data.layers[usage].scores[t];
				usages[t] = CONFLICT;

				Array* c = &conflictLayers[t];
				Array_createAllowed(c, sizeof(int), 2);
				*Array_push(int, c) = usage;
				*Array_push(int, c) = layerIndex;
				*Array_push(int, &conflictTasks) = t;
				
			} else {
				*Array_push(int, &conflictLayers[t]) = layerIndex;
			}

			leftDuration -= optDuration;

			if (leftDuration == 0)
				break; // end
			
		}

		layerDurations[layerIndex] = realLeftDuration;
	}
	

	// No conflicts
	if (conflictTasks.length == 0) {
		free(conflictLayers);
		return scoreBase;
	}

	

	// Set first states
	Array_loop(int, conflictTasks, ptr) {
		int t = *ptr;
		int layer = *Array_get(int, conflictLayers[t], 0);
		usages[t] = layer;
		scoreBase += data.layers[layer].scores[t];
	}

	int* states = calloc(conflictTasks.length, sizeof(int));


	int bestScore = 0x80000000;
	size_t size = sizeof(int) * shared.slots_len;
	int* const subLayerDurations = malloc(size);
	memcpy(subLayerDurations, layerDurations, size);
	
	size = sizeof(int) * shared.tasks_len;
	int* const subUsages = malloc(size);
	memcpy(subUsages, usages, size);
	int* const bestUsages = malloc(size);


	while (true) {
		int s = scoreBase + pushLayers(subUsages, usages, subLayerDurations);
		if (s > bestScore) {
			bestScore = s;
			memcpy(bestUsages, subUsages, size);
		}



		// Move state
		int i = 0; 
		while (true) {
			int s = states[i];
			int t = *Array_get(int, conflictTasks, i);
			int l = *Array_get(int, conflictLayers[t], s);
			int duration = shared.tasks[t].duration;
			scoreBase -= data.layers[l].scores[t];
			layerDurations[l] += duration;
			
			s++;
			if (s < conflictLayers[t].length) {
				l = *Array_get(int, conflictLayers[t], s);
				layerDurations[l] -= duration;
				usages[t] = l;
				states[i] = s;
				scoreBase += data.layers[l].scores[t];
				break;
			}
			
			states[i] = 0;
			l = *Array_get(int, conflictLayers[t], 0);
			layerDurations[l] -= duration;
			usages[t] = l;
			scoreBase += data.layers[l].scores[t];

			i++;
			if (i == conflictTasks.length)
				goto finishStates;
		}	
	}




	finishStates:

	// Return best usages
	memcpy(usages, bestUsages, sizeof(int) * shared.tasks_len);

	free(subUsages);
	free(subLayerDurations);
	free(bestUsages);
	



	// Free data
	free(states);
	Array_loop(int, conflictTasks, pos) {
		Array_free(conflictLayers[*pos]);
	}

	Array_free(conflictTasks);
	free(conflictLayers);
	return bestScore;
}





int* runAlgo(void) {
	data.units = malloc(sizeof(Unit) * shared.tasks_len);
	for (int i = 0; i < shared.tasks_len; i++) {
		Unit* u = &data.units[i];
		const Task* t = &shared.tasks[i];
		u->task = t;
		u->duration = t->duration;
		u->type = t->type;
		u->level = t->level;
	}

	data.layers = newLayers();

	int* ownerListArg = malloc(sizeof(int) * shared.tasks_len);
	int* pureOwnerListArg = malloc(sizeof(int) * shared.tasks_len);
	int* layerDurations = malloc(sizeof(int) * shared.slots_len);
	for (int i = 0; i < shared.tasks_len; i++) {
		ownerListArg[i] = AVAILABLE;
		pureOwnerListArg[i] = AVAILABLE;
	}

	for (int i = 0; i < shared.slots_len; i++) {
		layerDurations[i] = shared.slots[i].duration;
	}

	pushLayers(ownerListArg, pureOwnerListArg, layerDurations);


	free(pureOwnerListArg);
	free(layerDurations);
	freeLayers(data.layers);
	free(data.units);

	return ownerListArg;
}