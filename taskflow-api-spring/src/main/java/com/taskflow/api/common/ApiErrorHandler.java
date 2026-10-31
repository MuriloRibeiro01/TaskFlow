package com.taskflow.api.common;

import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;
import tools.jackson.databind.exc.UnrecognizedPropertyException;

@RestControllerAdvice
public class ApiErrorHandler extends ResponseEntityExceptionHandler {

  /** Todas as exceções do Spring MVC (validação, JSON inválido, 404 de rota...) passam por aqui. */
  @Override
  protected ResponseEntity<Object> handleExceptionInternal(
      Exception ex, Object body, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
    return ResponseEntity.status(status).headers(headers).body(of(status, message(ex, status)));
  }

  @org.springframework.web.bind.annotation.ExceptionHandler(MethodArgumentTypeMismatchException.class)
  ResponseEntity<Object> typeMismatch(MethodArgumentTypeMismatchException ex) {
    return ResponseEntity.badRequest()
        .body(of(HttpStatus.BAD_REQUEST, ex.getName() + " inválido"));
  }

  public static ApiError of(HttpStatusCode status, Object message) {
    HttpStatus resolved = HttpStatus.resolve(status.value());
    String error = resolved != null ? resolved.getReasonPhrase() : "Error";
    return new ApiError(status.value(), error, message);
  }

  private static Object message(Exception ex, HttpStatusCode status) {
    if (ex instanceof MethodArgumentNotValidException e) {
      return e.getFieldErrors().stream().map(f -> f.getField() + ": " + f.getDefaultMessage()).toList();
    }
    if (ex instanceof HandlerMethodValidationException e) {
      return e.getAllErrors().stream().map(err -> err.getDefaultMessage()).toList();
    }
    if (ex instanceof HttpMessageNotReadableException e) {
      if (e.getCause() instanceof UnrecognizedPropertyException u) {
        return List.of("property " + u.getPropertyName() + " should not exist");
      }
      return "Corpo da requisição inválido";
    }
    if (ex instanceof ResponseStatusException e && e.getReason() != null) {
      return e.getReason();
    }
    HttpStatus resolved = HttpStatus.resolve(status.value());
    return resolved != null ? resolved.getReasonPhrase() : ex.getMessage();
  }
}
