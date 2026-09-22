tasks.register<Exec>("npmBuild") {
    commandLine("npm", "run", "build")
}

tasks.register("assembleDebug") {
    dependsOn("npmBuild")
    doLast {
        println("React applet built successfully for web runtime.")
    }
}

tasks.register("build") {
    dependsOn("assembleDebug")
}
