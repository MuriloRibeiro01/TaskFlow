package com.taskflow.api.task;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

/** Toda consulta por id também filtra pelo dono: não existe busca de tarefa só pelo id. */
public interface TaskRepository extends JpaRepository<Task, Integer> {

  List<Task> findByUserIdOrderByCreatedAtDesc(Integer userId);

  List<Task> findByUserIdAndStatusOrderByCreatedAtDesc(Integer userId, TaskStatus status);

  Optional<Task> findByIdAndUserId(Integer id, Integer userId);

  /** Confere o dono e apaga numa única query. */
  @Transactional
  @Modifying
  @Query("delete from Task t where t.id = :id and t.userId = :userId")
  int deleteByIdAndUserId(@Param("id") Integer id, @Param("userId") Integer userId);
}
