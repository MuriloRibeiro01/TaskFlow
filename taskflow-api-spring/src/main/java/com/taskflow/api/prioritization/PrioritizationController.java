package com.taskflow.api.prioritization;

import com.taskflow.api.auth.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/prioritization")
class PrioritizationController {

  private final PrioritizationService prioritization;

  PrioritizationController(PrioritizationService prioritization) {
    this.prioritization = prioritization;
  }

  @PostMapping("/suggestions")
  SuggestionsResponse suggest(
      @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody(required = false) SuggestionsRequest request) {
    return prioritization.suggest(CurrentUser.id(jwt), request == null ? null : request.taskIds());
  }
}
