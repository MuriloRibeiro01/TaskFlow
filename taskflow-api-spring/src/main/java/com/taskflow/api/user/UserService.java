package com.taskflow.api.user;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserService {

  private final UserRepository users;

  UserService(UserRepository users) {
    this.users = users;
  }

  /** O token pode continuar válido depois que o usuário foi apagado. */
  public User findMe(int id) {
    return users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
  }

  public User updateMe(int id, UpdateMeRequest request) {
    User user = findMe(id);
    if (request.routineText() != null) {
      user.setRoutineText(request.routineText().isBlank() ? null : request.routineText());
    }
    return users.save(user);
  }
}
