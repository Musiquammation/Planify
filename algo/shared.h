#ifndef ORG_SHARED_H_
#define ORG_SHARED_H_

#include "declarations.h"
#include <stddef.h>


typedef struct {
	const Task* tasks;
	const Slot* slots;
	int tasks_len;
	int slots_len;

	
	float lossOrder;
	char* completions;
	int* completionDurations;
	Branch* branchList;
	int** lostTasksBuffer;

	size_t branchList_size;

	struct {
		Branch* list;
		char* lostTasks;
		float score;
	} best;

} shared_t;

extern shared_t shared;


#endif
