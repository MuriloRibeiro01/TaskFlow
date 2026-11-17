package com.taskflow.api.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DevLoginRequest(
    @NotBlank @Email @Size(max = 254) String email, @Size(max = 100) String displayName) {}
