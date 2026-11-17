package com.taskflow.api.infrastructure.jpa;

import com.taskflow.api.domain.session.PomodoroSession;
import com.taskflow.api.domain.session.SessionStatus;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** Como em TaskRepository: toda consulta por id também filtra pelo dono. */
public interface SessionRepository extends JpaRepository<PomodoroSession, Integer> {

  List<PomodoroSession> findByUserIdOrderByStartedAtDesc(Integer userId);

  Optional<PomodoroSession> findByIdAndUserId(Integer id, Integer userId);

  @Transactional
  @Modifying
  @Query("delete from PomodoroSession s where s.id = :id and s.userId = :userId")
  int deleteByIdAndUserId(@Param("id") Integer id, @Param("userId") Integer userId);

  @Query("select count(s) from PomodoroSession s where s.userId = :userId and s.status = :status and s.startedAt >= :from and s.startedAt < :to")
  int countByUserIdAndStatusAndStartedAtBetween(@Param("userId") Integer userId, @Param("status") SessionStatus status, @Param("from") Instant from, @Param("to") Instant to);
}
