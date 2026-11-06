import "./global.css";

import { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";

import { splitDisclaimer } from "@convai/core";
import { Button } from "@convai/ui/button";

// Starter screen (spec 007): proves the shared packages run on a device. The chat screen comes later.
const { body, disclaimer } = splitDisclaimer("Shared logic is working.\n\n_Demo data._");

export default function App() {
  const [pressed, setPressed] = useState(false);

  return (
    <View className="flex-1 items-center justify-center gap-4 bg-background p-6">
      <Text className="text-2xl font-semibold text-foreground">PFG Wealth Assistant</Text>
      <Text className="text-base text-foreground">{body}</Text>
      <Text className="text-xs text-muted-foreground">{disclaimer}</Text>
      <Button size="lg" onPress={() => setPressed(true)}>
        Try the shared Button
      </Button>
      {pressed && <Text className="text-sm text-primary">Button pressed</Text>}
      <StatusBar style="auto" />
    </View>
  );
}
