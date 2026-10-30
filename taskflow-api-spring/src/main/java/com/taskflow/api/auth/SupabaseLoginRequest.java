package com.taskflow.api.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SupabaseLoginRequest(@NotBlank @Size(max = 4096) String accessToken) {}
