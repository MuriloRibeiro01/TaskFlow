FROM eclipse-temurin:17-jdk AS build
WORKDIR /app
# Dependências numa camada separada: só baixa de novo quando o pom.xml muda.
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN ./mvnw -q -B dependency:go-offline
COPY src src
# Os testes rodam fora da imagem (precisam do Docker para o Testcontainers).
RUN ./mvnw -q -B package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --no-create-home app
COPY --from=build /app/target/*.jar app.jar
USER app
EXPOSE 3000
# Heap limitado: a máquina de desenvolvimento tem pouca RAM livre.
ENTRYPOINT ["java", "-Xmx256m", "-jar", "app.jar"]
