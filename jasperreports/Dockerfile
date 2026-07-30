FROM tomcat:9-jdk11

# Download JasperReports Server WAR
RUN wget -O /tmp/jasperserver.war https://sourceforge.net/projects/jasperserver/files/JasperServer/JasperReports%20Server%207.2.0/TIB_js-jrs_7.2.0_bin.zip/download

# Extract and deploy
RUN unzip /tmp/jasperserver.war -d /usr/local/tomcat/webapps/jasperserver

EXPOSE 8080

CMD ["catalina.sh", "run"]
