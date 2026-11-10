package com.taskflow.api.auth;

import com.taskflow.api.user.User;

public record LoginResponse(String accessToken, User user) {}
