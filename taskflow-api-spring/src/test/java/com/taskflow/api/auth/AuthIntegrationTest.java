package com.taskflow.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.taskflow.api.IntegrationTest;
import com.taskflow.api.user.UserRepository;
import java.time.Instant;
import java.util.UUID;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class AuthIntegrationTest {

  @Autowired MockMvc mvc;
  @Autowired UserRepository users;
  @Autowired JwtEncoder encoder;

  private final String email = "it-" + UUID.randomUUID() + "@taskflow.test";

  private String login(String body) throws Exception {
    String json =
        mvc.perform(post("/auth/dev-login").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isOk())
            .andReturn()
            .getResponse()
            .getContentAsString();
    return json;
  }

  private static String token(JwtEncoder encoder, Instant expiresAt) {
    JwtClaimsSet claims =
        JwtClaimsSet.builder().subject("1").issuedAt(expiresAt.minusSeconds(60)).expiresAt(expiresAt).build();
    return encoder
        .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
        .getTokenValue();
  }

  @Test
  void loginDevolveTokenEUsersMeDevolveOProprioUsuario() throws Exception {
    String json = login("{\"email\":\"" + email + "\",\"displayName\":\"IT\"}");
    assertThat((String) JsonPath.read(json, "$.user.email")).isEqualTo(email);
    assertThat((String) JsonPath.read(json, "$.user.displayName")).isEqualTo("IT");
    String accessToken = JsonPath.read(json, "$.accessToken");
    Integer id = JsonPath.read(json, "$.user.id");

    mvc.perform(get("/users/me").header("Authorization", "Bearer " + accessToken))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.id").value(id))
        .andExpect(jsonPath("$.email").value(email))
        .andExpect(jsonPath("$.displayName").value("IT"))
        .andExpect(jsonPath("$.avatarUrl").isEmpty());
  }

  @Test
  void loginRepetidoComMaiusculasNaoDuplicaENaoApagaODisplayName() throws Exception {
    Integer first = JsonPath.read(login("{\"email\":\"" + email + "\",\"displayName\":\"IT\"}"), "$.user.id");
    String again = login("{\"email\":\"" + email.toUpperCase() + "\"}");
    assertThat((Integer) JsonPath.read(again, "$.user.id")).isEqualTo(first);
    assertThat((String) JsonPath.read(again, "$.user.displayName")).isEqualTo("IT");
    assertThat(users.findAll().stream().filter(u -> email.equals(u.getEmail())).count()).isEqualTo(1);
  }

  @Test
  void devLoginValidaOCorpoNoFormatoDeErroDoNest() throws Exception {
    mvc.perform(post("/auth/dev-login").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"nao-e-email\"}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.statusCode").value(400))
        .andExpect(jsonPath("$.error").value("Bad Request"))
        .andExpect(jsonPath("$.message").isArray());

    mvc.perform(post("/auth/dev-login").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\",\"id\":1}"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message[0]").value("property id should not exist"));

    mvc.perform(post("/auth/dev-login").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isBadRequest());
    mvc.perform(post("/auth/dev-login").contentType(MediaType.APPLICATION_JSON).content("{nao é json"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void usersMeRecusaTokenAusenteInvalidoForjadoOuExpirado() throws Exception {
    mvc.perform(get("/users/me"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.statusCode").value(401))
        .andExpect(jsonPath("$.message").value("Unauthorized"));
    mvc.perform(get("/users/me").header("Authorization", "Bearer abc.def.ghi")).andExpect(status().isUnauthorized());
    mvc.perform(get("/users/me").header("Authorization", "Basic abc")).andExpect(status().isUnauthorized());

    JwtEncoder forger =
        new NimbusJwtEncoder(new ImmutableSecret<>(new SecretKeySpec("y".repeat(32).getBytes(), "HmacSHA256")));
    String forged = token(forger, Instant.now().plusSeconds(3600));
    mvc.perform(get("/users/me").header("Authorization", "Bearer " + forged)).andExpect(status().isUnauthorized());

    String expired = token(encoder, Instant.now().minusSeconds(3600));
    mvc.perform(get("/users/me").header("Authorization", "Bearer " + expired)).andExpect(status().isUnauthorized());
  }

  @Test
  void usersMeResponde404QuandoOUsuarioDoTokenFoiApagado() throws Exception {
    String json = login("{\"email\":\"" + email + "\"}");
    String accessToken = JsonPath.read(json, "$.accessToken");
    users.deleteById(JsonPath.read(json, "$.user.id"));

    mvc.perform(get("/users/me").header("Authorization", "Bearer " + accessToken))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.statusCode").value(404));
  }
}
