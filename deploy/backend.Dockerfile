FROM eclipse-temurin:11-jre-alpine

WORKDIR /app

RUN addgroup -S shoptest && adduser -S shoptest -G shoptest

COPY target/shop-0.0.1-SNAPSHOT.jar /app/shop.jar

RUN mkdir -p /app/uploads && chown -R shoptest:shoptest /app

USER shoptest

EXPOSE 8081

ENV JAVA_OPTS="-Xms128m -Xmx512m -XX:MaxMetaspaceSize=192m -XX:+UseG1GC -XX:+ExitOnOutOfMemoryError -Dfile.encoding=UTF-8"

ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar /app/shop.jar"]
