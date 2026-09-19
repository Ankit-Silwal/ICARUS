UPDATE languages
SET
  compile_cmd = '/usr/local/openjdk13/bin/javac -J-Xms16m -J-Xmx128m -J-XX:ReservedCodeCacheSize=64m -J-XX:MaxMetaspaceSize=128m -J-XX:CompressedClassSpaceSize=32m -J-XX:+UseSerialGC %s Main.java',
  run_cmd = '/usr/local/openjdk13/bin/java -Xms16m -Xmx128m -XX:ReservedCodeCacheSize=64m -XX:MaxMetaspaceSize=128m -XX:CompressedClassSpaceSize=32m -XX:+UseSerialGC Main'
WHERE id = 62;

UPDATE languages
SET run_cmd = '/usr/local/node-12.14.0/bin/node --jitless --max-old-space-size=128 script.js'
WHERE id = 63;
