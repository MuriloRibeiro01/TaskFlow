package com.taskflow.api.application.user;

public record MeStatsResponse(int pomodorosToday, int tasksCompletedToday, int pomodorosThisWeek) {}
