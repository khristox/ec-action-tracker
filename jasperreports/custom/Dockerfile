FROM tomcat:9-jdk11-openjdk-slim

RUN apt-get update && apt-get install -y wget unzip && rm -rf /var/lib/apt/lists/*

WORKDIR /tmp
RUN wget -O jasper.zip "https://sourceforge.net/projects/jasperserver/files/JasperServer/JasperReports%20Server%207.2.0/TIB_js-jrs_7.2.0_bin.zip/download" && \
    unzip jasper.zip && \
    find . -name "*.war" -exec cp {} /usr/local/tomcat/webapps/ROOT.war \; && \
    cd / && rm -rf /tmp/*

RUN mkdir -p /usr/local/tomcat/webapps/ROOT && \
    cd /usr/local/tomcat/webapps && \
    unzip -q ROOT.war -d ROOT && \
    rm ROOT.war

ENV DB_HOST=postgres \
    DB_PORT=5432 \
    DB_USER=jasperadmin \
    DB_PASSWORD=jasperpass \
    DB_NAME=jasperserver

EXPOSE 8080

CMD ["catalina.sh", "run"]
