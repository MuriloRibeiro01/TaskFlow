package com.taskflow.api.application.auth;

import com.taskflow.api.config.JwtConfig;
import com.taskflow.api.domain.user.User;
import com.taskflow.api.infrastructure.jpa.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {

  static final Duration TOKEN_TTL = Duration.ofDays(7);

  private final UserRepository users;
  private final JwtEncoder encoder;
  private final BCryptPasswordEncoder passwordEncoder;

  AuthService(UserRepository users, JwtEncoder encoder, BCryptPasswordEncoder passwordEncoder) {
    this.users = users;
    this.encoder = encoder;
    this.passwordEncoder = passwordEncoder;
  }

  @Transactional
  public LoginResponse register(EmailAuthRequest req) {
    String email = req.email().toLowerCase(Locale.ROOT);
    if (users.findByEmail(email).isPresent())
      throw new ResponseStatusException(HttpStatus.CONFLICT);
    User user = new User(email);
    user.setPasswordHash(passwordEncoder.encode(req.password()));
    user = users.save(user);
    return new LoginResponse(issueToken(user), user);
  }

  @Transactional
  public LoginResponse emailLogin(EmailAuthRequest req) {
    String email = req.email().toLowerCase(Locale.ROOT);
    User user = users.findByEmail(email)
        .filter(u -> u.getPasswordHash() != null && passwordEncoder.matches(req.password(), u.getPasswordHash()))
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
    return new LoginResponse(issueToken(user), user);
  }

  @Transactional
  public LoginResponse devLogin(DevLoginRequest request) {
    String email = request.email().toLowerCase(Locale.ROOT);
    User user = users.findByEmail(email).orElseGet(() -> new User(email));
    if (request.displayName() != null && !request.displayName().isEmpty())
      user.setDisplayName(request.displayName());
    user = users.save(user);
    return new LoginResponse(issueToken(user), user);
  }

  private String issueToken(User user) {
    Instant now = Instant.now();
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
            .issuer(JwtConfig.ISSUER)
            .audience(List.of(JwtConfig.AUDIENCE))
            .subject(String.valueOf(user.getId()))
            .claim("email", user.getEmail())
            .issuedAt(now)
            .expiresAt(now.plus(TOKEN_TTL))
            .build();
    return encoder
        .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
        .getTokenValue();
  }
}
