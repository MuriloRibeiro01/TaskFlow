package com.taskflow.api.application.auth;

import com.taskflow.api.domain.user.User;

public record LoginResponse(String accessToken, User user) {}
