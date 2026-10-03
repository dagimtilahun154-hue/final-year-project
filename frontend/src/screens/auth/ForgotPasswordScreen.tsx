import React, { useState } from "react";
import { View } from "react-native";
import { EnvelopeSimple, ArrowRight, LockKey } from "phosphor-react-native";
import {
  Page,
  Text,
  Field,
  Button,
  Notice,
} from "../../components/design/System";
import { apiClient } from "../../api/client";
export function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  async function submit() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFailed(true);
      setMessage("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/auth/forgot-password", { email });
      setFailed(false);
      setMessage(
        "Your reset request has been received. Contact the daycare for the next step.",
      );
    } catch {
      setFailed(true);
      setMessage("Unable to send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Page header={false} title="Forgot Password" back decorative>
      <View style={{ height: 70 }} />
      <View
        style={{
          alignSelf: "center",
          padding: 22,
          borderRadius: 50,
          backgroundColor: "#FFF0C9",
          marginBottom: 24,
        }}
      >
        <LockKey size={36} color="#7D621E" />
      </View>
      <Text size={28} weight="bold" style={{ textAlign: "center" }}>
        Let’s get you back in
      </Text>
      <Text color="#737781" style={{ textAlign: "center", marginVertical: 18 }}>
        Enter the email linked to your daycare account.
      </Text>
      <Field
        label="Email address"
        icon={EnvelopeSimple}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        placeholder="Your email address"
      />
      {message ? (
        <Notice tone={failed ? "error" : "success"}>{message}</Notice>
      ) : null}
      <Button
        title="Send Reset Request"
        icon={ArrowRight}
        onPress={submit}
        loading={busy}
      />
    </Page>
  );
}
