package com.taskflow.api.session;

import com.taskflow.api.auth.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/sessions")
class SessionController {

  private final SessionService sessions;

  SessionController(SessionService sessions) {
    this.sessions = sessions;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  PomodoroSession create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateSessionRequest request) {
    return sessions.create(CurrentUser.id(jwt), request);
  }

  @GetMapping
  List<PomodoroSession> findAll(@AuthenticationPrincipal Jwt jwt) {
    return sessions.findAll(CurrentUser.id(jwt));
  }

  @PatchMapping("/{id}")
  PomodoroSession update(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable @Min(1) Integer id,
      @Valid @RequestBody UpdateSessionRequest request) {
    return sessions.update(CurrentUser.id(jwt), id, request);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void remove(@AuthenticationPrincipal Jwt jwt, @PathVariable @Min(1) Integer id) {
    sessions.remove(CurrentUser.id(jwt), id);
  }
}
