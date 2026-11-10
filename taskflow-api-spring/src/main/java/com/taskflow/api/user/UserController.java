package com.taskflow.api.user;

import com.taskflow.api.auth.CurrentUser;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/users")
class UserController {

  private final UserService users;

  UserController(UserService users) {
    this.users = users;
  }

  @GetMapping("/me")
  User me(@AuthenticationPrincipal Jwt jwt) {
    return users.findMe(CurrentUser.id(jwt));
  }
}
