package com.taskflow.api.application.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EmailAuthRequest(
    @NotBlank @Email String email,
    @NotBlank @Size(min = 8, max = 72) String password) {}
