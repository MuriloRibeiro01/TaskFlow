package com.taskflow.api.session;

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
}
