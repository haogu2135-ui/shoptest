FROM eclipse-temurin:11-jre

WORKDIR /app
ARG JAR_FILE=shop-gateway/target/shop-gateway-0.0.1-SNAPSHOT.jar
COPY ${JAR_FILE} app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
