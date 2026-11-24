package com.taskflow.api.infrastructure.jpa;

import com.taskflow.api.domain.user.User;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Integer> {
  Optional<User> findByEmail(String email);
}
