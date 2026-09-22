package com.threatshield.android

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

/** A single chat message, either from the user or from the AI model. */
data class ChatMessage(
    val role: String,      // "user" or "model"
    val text: String,
    val timestamp: Long = System.currentTimeMillis(),
    val isError: Boolean = false,
)

/** Represents a distinct conversation thread. */
data class ChatSession(
    val id: String,
    val title: String,
    val timestamp: Long,
)

/** Persists chat sessions and their message history in SharedPreferences. */
object GeminiChatStore {
    private const val PREFS = "gemini_chat"
    private const val SESSIONS_KEY = "sessions"
    private const val MAX_MESSAGES = 100

    fun sessions(context: Context): List<ChatSession> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(SESSIONS_KEY, "") ?: ""
        if (raw.isBlank()) return emptyList()
        return try {
            val array = JSONArray(raw)
            (0 until array.length()).mapNotNull { i ->
                val obj = array.optJSONObject(i) ?: return@mapNotNull null
                ChatSession(
                    id = obj.optString("id", ""),
                    title = obj.optString("title", "New Chat"),
                    timestamp = obj.optLong("ts", System.currentTimeMillis())
                )
            }.sortedByDescending { it.timestamp }
        } catch (_: Exception) { emptyList() }
    }

    fun createSession(context: Context, title: String = "New Chat"): ChatSession {
        val session = ChatSession(id = UUID.randomUUID().toString(), title = title, timestamp = System.currentTimeMillis())
        val current = sessions(context).toMutableList()
        current.add(0, session)
        saveSessions(context, current)
        return session
    }

    private fun saveSessions(context: Context, sessions: List<ChatSession>) {
        val array = JSONArray(sessions.map { s ->
            JSONObject().apply {
                put("id", s.id)
                put("title", s.title)
                put("ts", s.timestamp)
            }
        })
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(SESSIONS_KEY, array.toString()).apply()
    }

    private fun updateSessionTimestamp(context: Context, sessionId: String) {
        val current = sessions(context).toMutableList()
        val index = current.indexOfFirst { it.id == sessionId }
        if (index != -1) {
            val s = current[index]
            current[index] = s.copy(timestamp = System.currentTimeMillis())
            current.sortByDescending { it.timestamp }
            saveSessions(context, current)
        }
    }

    fun messages(context: Context, sessionId: String): List<ChatMessage> {
        val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("history_$sessionId", "") ?: ""
        if (raw.isBlank()) return emptyList()
        return try {
            val array = JSONArray(raw)
            (0 until array.length()).mapNotNull { i ->
                val obj = array.optJSONObject(i) ?: return@mapNotNull null
                ChatMessage(
                    role = obj.optString("role", "user"),
                    text = obj.optString("text", ""),
                    timestamp = obj.optLong("ts", System.currentTimeMillis()),
                    isError = obj.optBoolean("err", false),
                )
            }
        } catch (_: Exception) { emptyList() }
    }

    fun append(context: Context, sessionId: String, message: ChatMessage) {
        val updated = (messages(context, sessionId) + message).takeLast(MAX_MESSAGES)
        saveMessages(context, sessionId, updated)
        updateSessionTimestamp(context, sessionId)
    }

    private fun saveMessages(context: Context, sessionId: String, messages: List<ChatMessage>) {
        val array = JSONArray(messages.map { msg ->
            JSONObject().apply {
                put("role", msg.role)
                put("text", msg.text)
                put("ts", msg.timestamp)
                put("err", msg.isError)
            }
        })
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString("history_$sessionId", array.toString()).apply()
    }

    fun deleteSession(context: Context, sessionId: String) {
        val current = sessions(context).filter { it.id != sessionId }
        saveSessions(context, current)
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove("history_$sessionId").apply()
    }

    fun clearAll(context: Context) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply()
    }
}

/**
 * Sends a user message through the backend chat API for a specific session.
 * Automatically appends the user message and AI reply to GeminiChatStore.
 * Call on a background dispatcher (Dispatchers.IO).
 */
suspend fun sendChatMessage(context: Context, sessionId: String, userMessage: String): ChatMessage {
    val userMsg = ChatMessage(role = "user", text = userMessage)
    GeminiChatStore.append(context, sessionId, userMsg)

    val history = GeminiChatStore.messages(context, sessionId).dropLast(1) // exclude the message just added
    val response = BackendUploader.chat(context, userMessage, history)

    val aiMsg = if (response != null) {
        ChatMessage(role = "model", text = response)
    } else {
        ChatMessage(role = "model", text = "Could not reach the AI. Check your backend connection.", isError = true)
    }
    GeminiChatStore.append(context, sessionId, aiMsg)
    return aiMsg
}
