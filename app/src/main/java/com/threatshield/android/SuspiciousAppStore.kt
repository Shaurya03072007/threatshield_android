package com.threatshield.android

import android.content.Context
import android.content.SharedPreferences

object SuspiciousAppStore {
    private const val PREFS = "suspicious_apps"
    
    private fun prefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    }

    /** Returns true if the package is marked as suspicious by the user. */
    fun isSuspicious(context: Context, packageName: String): Boolean {
        return prefs(context).getBoolean(packageName, false)
    }

    /** Marks or unmarks a package as suspicious. */
    fun setSuspicious(context: Context, packageName: String, isSuspicious: Boolean) {
        if (isSuspicious) {
            prefs(context).edit().putBoolean(packageName, true).apply()
        } else {
            prefs(context).edit().remove(packageName).apply()
        }
    }

    /** Returns all packages marked as suspicious. */
    fun getAllSuspiciousApps(context: Context): List<String> {
        return prefs(context).all.keys.toList()
    }
}
