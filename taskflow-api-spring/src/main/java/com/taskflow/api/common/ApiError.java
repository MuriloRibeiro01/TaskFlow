package com.taskflow.api.common;

/** Mesmo formato de erro do backend Nest: { statusCode, error, message }. */
public record ApiError(int statusCode, String error, Object message) {}
