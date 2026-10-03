import React, { useRef, useState } from "react";
import { View, TextInput } from "react-native";
import { LockKey, ArrowRight } from "phosphor-react-native";
import { Page, Text, Button, Notice } from "../../components/design/System";
import { fonts } from "../../theme/tokens";
export function OTPScreen() {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const refs = useRef<(TextInput | null)[]>([]);
  const [message, setMessage] = useState("");
  return (
    <Page title="Verification Code" back decorative>
      <View style={{ alignItems: "center", paddingTop: 40 }}>
        <View
          style={{ padding: 20, borderRadius: 40, backgroundColor: "#F3F3EE" }}
        >
          <LockKey size={30} />
        </View>
        <Text size={28} weight="bold" style={{ marginTop: 24 }}>
          Enter Code
        </Text>
        <Text color="#747984" style={{ textAlign: "center", marginTop: 12 }}>
          Enter the code sent to your linked account.
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 40 }}>
        {digits.map((digit, i) => (
          <TextInput
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            accessibilityLabel={"Code digit " + (i + 1)}
            keyboardType="number-pad"
            maxLength={1}
            value={digit}
            onChangeText={(v) => {
              const next = [...digits];
              next[i] = v.replace(/\D/g, "");
              setDigits(next);
              if (next[i]) refs.current[i + 1]?.focus();
            }}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === "Backspace" && !digits[i])
                refs.current[i - 1]?.focus();
            }}
            style={{
              flex: 1,
              minWidth: 0,
              height: 56,
              textAlign: "center",
              backgroundColor: "#fff",
              borderRadius: 12,
              fontFamily: fonts.semibold,
              fontSize: 22,
              borderWidth: 1,
              borderColor: "#EEE8D7",
            }}
          />
        ))}
      </View>
      <View style={{ flex: 1, minHeight: 120 }} />
      {message ? <Notice>{message}</Notice> : null}
      <Button
        title="Verify Code"
        icon={ArrowRight}
        disabled={digits.some((d) => !d)}
        onPress={() =>
          setMessage(
            "Code verification is not connected yet. Please contact your daycare.",
          )
        }
      />
      <Text
        size={13}
        color="#747984"
        style={{ textAlign: "center", marginTop: 20 }}
      >
        Need a new code? Contact your daycare.
      </Text>
    </Page>
  );
}
