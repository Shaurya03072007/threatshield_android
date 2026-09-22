package com.threatshield.fixture;

import android.Manifest;
import android.app.Activity;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.LinearLayout;
import android.widget.TextView;

/** A benign, visible permission fixture. It has no network, service, receiver, storage, or data-use code. */
public final class FixtureActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        layout.setGravity(Gravity.CENTER);
        layout.setPadding(48, 48, 48, 48);
        TextView text = new TextView(this);
        text.setText("ThreatShield Risk Fixture\n\nThis harmless test app requests four permissions only so ThreatShield can verify its risk scanner. It contains no networking, monitoring, data collection, services, or hidden behavior. Uninstall it after testing.");
        text.setTextSize(18);
        layout.addView(text);
        setContentView(layout);
        requestPermissions(new String[] { Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO, Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.READ_CONTACTS }, 10);
    }
}
