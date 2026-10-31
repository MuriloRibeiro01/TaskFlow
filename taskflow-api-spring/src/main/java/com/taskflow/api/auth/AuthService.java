package com.taskflow.api.auth;

import com.taskflow.api.user.User;
import com.taskflow.api.user.UserRepository;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

  // Sem refresh token: ao expirar, o app pede o login com Google de novo.
  static final Duration TOKEN_TTL = Duration.ofDays(30);

  private final UserRepository users;
  private final JwtEncoder encoder;

  AuthService(UserRepository users, JwtEncoder encoder) {
    this.users = users;
    this.encoder = encoder;
  }

  @Transactional
  public LoginResponse devLogin(DevLoginRequest request) {
    return login(request.email(), request.displayName(), null);
  }

  @Transactional
  public LoginResponse login(GoogleAuth.Identity id) {
    return login(id.email(), id.displayName(), id.avatarUrl());
  }

  private LoginResponse login(String rawEmail, String displayName, String avatarUrl) {
    // O índice único do Postgres diferencia maiúsculas; sem isso "A@x" e "a@x" virariam 2 contas.
    String email = rawEmail.toLowerCase(Locale.ROOT);
    User user = users.findByEmail(email).orElseGet(() -> new User(email));
    if (displayName != null && !displayName.isEmpty()) user.setDisplayName(displayName);
    if (avatarUrl != null && !avatarUrl.isEmpty()) user.setAvatarUrl(avatarUrl);
    user = users.save(user);
    return new LoginResponse(issueToken(user), user);
  }

  private String issueToken(User user) {
    Instant now = Instant.now();
    JwtClaimsSet claims =
        JwtClaimsSet.builder()
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
