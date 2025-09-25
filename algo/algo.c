#include "algo.h"

#include "Task.h"
#include "Slot.h"
#include "shared.h"
#include "Branch.h"

#include "Array.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

// FILE* outputFile;
// #define print(fmt, ...) fprintf(outputFile, fmt, ##__VA_ARGS__)
#define print(fmt, ...) {}
#define PRINT false

static int compareTasks(const void* a, const void* b) {
	return ((Task*)b)->duration - ((Task*)a)->duration;
}

void sortTasks(Task* tasks, int tasks_len) {
	qsort(tasks, tasks_len, sizeof(Task), compareTasks);
}




int branchCount = 0;

void printTabs(int deep) {
	for (int i = 0; i < deep; i++) {
		// print("|   ");
		print("\t");
	}
}

void handleEnd(float score) {
	printTabs(shared.tasks_len);
	print("end %f\n", score);

	if (score <= shared.best.score)
		return;

	// Branch list
	memcpy(shared.best.list, shared.branchList, shared.branchList_size);
	memset(shared.best.lostTasks, 0, shared.tasks_len);
	shared.best.score = score;

	// Get removed tasks
	for (int depth = 0; depth < shared.tasks_len; ++depth) {
		int lostCount = shared.best.list[depth].lostTasksCount;
		if (lostCount <= 0) continue;
		int *buffer = shared.lostTasksBuffer[depth];
		for (int k = 0; k < lostCount; ++k) {
			int task = buffer[k];
			if (task < 0 || task >= shared.tasks_len) continue; // sanity
			shared.best.lostTasks[task] = 1;
		}
	}

	// Print best branch
	if (PRINT) {
		printf("score %f\n", score);
		for (int slot = 0; slot < shared.slots_len; slot++) {
			printf ("Slot %d:\n", slot);
	
			for (int task = 0; task < shared.tasks_len; task++) {
				if (shared.best.lostTasks[task] == 0 && shared.best.list[task].receivingSlot == slot)
					printf ("  task %d (%d)\n", task, shared.tasks[task].duration);
			}
	
	
			printf("\n");
		}


		printf("\n--\n");
	}

}



float evalScore(float score,  Task* task) {
	return 0.0f;	
}

void handleBranch(int deep, float score) {
	branchCount++;
	printTabs(deep);
	print("here %d/%.1f\n", deep, score);

	#define getCompletion(slot, task) ((slot) * shared.tasks_len + (task))

	const Task* task = &shared.tasks[deep];
	int duration = task->duration;
	for (int slot = 0; slot < shared.slots_len; slot++) {
		love_t taskLove = shared.slots[slot].loveTable[task->type];
		if (taskLove > 250)
			continue;
		
		const float scoreBase = score + duration * taskLove * task->level;


		shared.branchList[deep].receivingSlot = slot;

		int slotDuration = shared.slots[slot].duration;

		int previewDuration = shared.completionDurations[slot] + duration;

		// Add directly task
		if (previewDuration <= slotDuration) {
			printTabs(deep);
			print("\n");
			printTabs(deep);
			print("Add in %02d as %s\n", slot, task->name);
			
			printTabs(deep);
			print("> cd %d\n", shared.completionDurations[slot]);



			shared.branchList[deep].lostTasksCount = 0;
			shared.completionDurations[slot] = previewDuration;


			shared.completions[getCompletion(slot, deep)] = 1;			

			// Call next branch
			if (deep+1 < shared.tasks_len) {
				handleBranch(deep+1, scoreBase);
			} else {
				handleEnd(scoreBase);
			}

			// Reset data
			shared.completionDurations[slot] = previewDuration - duration;
			printTabs(deep);
			print("> rt[%d] %d\n", slot, shared.completionDurations[slot]);

			shared.completions[getCompletion(slot, deep)] = 0;

		} else {
			printTabs(deep);
			print("\n");
			printTabs(deep);
			print("ADD in %02d as %s [RM]\n", slot, task->name);

			printTabs(deep);
			print("> CD %d\n", shared.completionDurations[slot]);

			// Remove tasks
			const int diff = previewDuration - slotDuration;

			int* lostTasks = shared.lostTasksBuffer[deep];


			const int startCompletion = getCompletion(slot, 0);


			shared.completions[startCompletion+deep] = 1; // add task

			// Run branches with removed tasks
			for (int i = 0; i < deep; i++) {
				int lostCount = 0;
				int extra = diff;
				float nextScore = scoreBase;

				// Run branch
				for (int j = i; j < deep; j++) {
					if (shared.completions[startCompletion+j] == 0)
						continue;
					
					// Remove task
					shared.completions[startCompletion+j] = 0;
					
					const Task* const subTask = &shared.tasks[j];
					extra -= subTask->duration;

					lostTasks[lostCount] = j;
					lostCount++;

					nextScore -= subTask->duration * shared.slots[slot].loveTable[subTask->type] * subTask->level;

					// Call branch by removing those lines
					if (extra <= 0) {
						// Check score
						printTabs(deep);
						print("> s=%.1f, m=%.1f (b=%.1f)", nextScore, scoreBase * deep * shared.lossOrder, scoreBase);

						if (nextScore <= scoreBase * (deep * shared.lossOrder)) {
							print(" (n)\n");
							break;
						}

						print(" (y)\n");


						shared.completionDurations[slot] = slotDuration + extra;
						shared.branchList[deep].lostTasksCount = lostCount;
						


						printTabs(deep);
						print("> removed: ");

						Array_for(int, lostTasks, lostCount, t) {
							print("%d ", *t);
						}

						print("\n");


						// Call next branch
						if (deep+1 < shared.tasks_len) {
							handleBranch(deep+1, nextScore);
						} else {
							handleEnd(nextScore);
						}

						break;
					}

				}
				
				// Restore removed tasks
				Array_for(int, lostTasks, lostCount, t) {
					shared.completions[startCompletion + *t] = 1;
				}
			}

			// Restore completionDurations
			shared.completionDurations[slot] = previewDuration - duration;
			
			shared.completions[startCompletion+deep] = 0; // remove task

			
			printTabs(deep);
			print("> RT[%d] %d\n", slot, shared.completionDurations[slot]);
			


			// Run without task
			printTabs(deep);
			print("> DROP\n");
			shared.branchList[deep].receivingSlot = -1;
			shared.branchList[deep].lostTasksCount = 0;

			if (deep+1 < shared.tasks_len) {
				handleBranch(deep+1, score);
			} else {
				handleEnd(score);
			}
		}


	}


	#undef getCompletion
}





void runAlgo(float lossOrder) {
	// outputFile = fopen("draft/output.txt", "w");

	shared.branchList_size = shared.tasks_len * sizeof(Branch);

	shared.lossOrder = lossOrder / shared.tasks_len;
	shared.completions = calloc(shared.tasks_len, shared.slots_len);
	shared.completionDurations = calloc(shared.slots_len, sizeof(float));
	shared.branchList = malloc(shared.branchList_size);
	shared.lostTasksBuffer = malloc(shared.tasks_len * sizeof(int*));


	shared.best.list = malloc(shared.branchList_size + shared.tasks_len);
	shared.best.lostTasks = &((char*)shared.best.list)[shared.branchList_size];
	shared.best.score = 0;

	Array_forPtr(int, shared.lostTasksBuffer, shared.tasks_len, i) {
		*i = malloc(shared.tasks_len * sizeof(int));
	}
	
	handleBranch(0, 0.0f);
	
	if (PRINT) {
		printf("branchCount: %d\n", branchCount);
	}

	free(shared.branchList);
	free(shared.completions);

	typedef int* ptr_t;
	Array_for(ptr_t, shared.lostTasksBuffer, shared.tasks_len, i) {
		int* ptr = *i;
		if (ptr)
			free(ptr);
	}



	// Print best branch
	if (PRINT) {
		for (int slot = 0; slot < shared.slots_len; slot++) {
			printf ("Slot %d:\n", slot);
	
			for (int task = 0; task < shared.tasks_len; task++) {
				if (shared.best.lostTasks[task] == 0 && shared.best.list[task].receivingSlot == slot)
					printf ("  task %d (%d)\n", task, shared.tasks[task].duration);
			}
	
	
			printf("\n");
		}
	}


	


	// fclose(outputFile);
	/// TODO: handle bestBranchList 
}