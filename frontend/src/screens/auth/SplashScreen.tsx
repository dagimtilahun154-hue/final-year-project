import React from "react";
import { View, useWindowDimensions } from "react-native";
import { SvgXml } from "react-native-svg";
import { ArrowRight } from "phosphor-react-native";
import { Page, Text, Button, BrandMark } from "../../components/design/System";
import { logoArtwork } from "../../theme/logoArtwork";
export function SplashScreen({ navigation }: any) {
  const { width } = useWindowDimensions();
  const size = Math.min(width, 480);
  return (
    <Page
      header={false}
      decorative
      contentStyle={{ paddingHorizontal: 32, paddingTop: 0 }}
    >
      <View style={{ position: "absolute", left: 32, top: 28 }}>
        <BrandMark size={82} />
      </View>
      <View
        style={{ alignItems: "center", marginHorizontal: -32, marginTop: 24 }}
      >
        <SvgXml xml={logoArtwork} width={size} height={(size * 416) / 390} />
      </View>
      <Text
        size={19}
        weight="medium"
        style={{ textAlign: "center", marginTop: 8 }}
      >
        Stay connected to their day.
      </Text>
      <View style={{ flex: 1, minHeight: 90 }} />
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          gap: 10,
          marginBottom: 32,
        }}
      >
        {["#FFD9D2", "#FFC42B", "#B4CAEB"].map((c) => (
          <View
            key={c}
            style={{
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: c,
            }}
          />
        ))}
      </View>
      <Button
        title="Get Started"
        icon={ArrowRight}
        onPress={() => navigation.navigate("Onboarding")}
      />
      <Text
        size={11}
        color="#787D87"
        style={{
          textAlign: "center",
          letterSpacing: 1.4,
          marginTop: 28,
          marginBottom: 24,
        }}
      >
        CONNECTING FAMILIES AND DAYCARE
      </Text>
    </Page>
  );
}
