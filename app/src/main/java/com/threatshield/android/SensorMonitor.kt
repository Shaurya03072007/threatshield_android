package com.threatshield.android

import android.content.Context

object SensorMonitor {
    // For demonstration, we simulate stealth background sensor usage.
    // In a production app, real-time background sensor tracking of other apps is restricted
    // by Android without root or privileged permissions.
    
    private var simulatedBackgroundApp: String? = null
    private var simulatedSensors = listOf<String>()

    fun simulateBackgroundUsage(packageName: String, sensors: List<String>) {
        simulatedBackgroundApp = packageName
        simulatedSensors = sensors
    }
    
    fun clearSimulation() {
        simulatedBackgroundApp = null
        simulatedSensors = emptyList()
    }

    /** Returns a list of sensors currently active for the given package in the background. */
    fun getActiveBackgroundSensors(context: Context, foregroundApp: String?): List<String> {
        val active = mutableListOf<String>()
        
        // Return simulated usage if the simulated app is NOT in the foreground
        if (simulatedBackgroundApp != null && simulatedBackgroundApp != foregroundApp) {
            active.addAll(simulatedSensors)
        }
        
        return active
    }
}
