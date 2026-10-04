package com.gdhameeja.runtracker;

import android.os.Bundle;
import com.gdhameeja.runtracker.tracking.RunTrackerPlugin;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(RunTrackerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
