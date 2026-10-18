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
  const [mode, setMode] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [daycareCode, setDaycareCode] = useState("");
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function submitRequest() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFailed(true);
      setMessage("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/auth/forgot-password", {
        email: email.trim(),
        daycare_code: daycareCode.trim() || undefined,
      });
      setFailed(false);
      setMessage(
        "If an account exists, a recovery token or instructions have been sent. If you have your recovery token, you can set a new password below.",
      );
    } catch {
      setFailed(true);
      setMessage("Unable to send your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReset() {
    if (!token.trim()) {
      setFailed(true);
      setMessage("Please enter the recovery token received from your administrator.");
      return;
    }
    if (newPassword.length < 8) {
      setFailed(true);
      setMessage("Password must be at least 8 characters long.");
      return;
    }
    setBusy(true);
    try {
      await apiClient.post("/auth/reset-password", {
        token: token.trim(),
        new_password: newPassword,
        daycare_code: daycareCode.trim() || undefined,
      });
      setFailed(false);
      setMessage("Password reset successful! You may now sign in with your new password.");
      setNewPassword("");
      setToken("");
    } catch (err: any) {
      setFailed(true);
      setMessage(err?.response?.data?.error || "Invalid or expired recovery token.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page header={false} title="Account Recovery" back decorative>
      <View style={{ height: 40 }} />
      <View
        style={{
          alignSelf: "center",
          padding: 20,
          borderRadius: 50,
          backgroundColor: "#FFF0C9",
          marginBottom: 20,
        }}
      >
        <LockKey size={32} color="#7D621E" />
      </View>
      <Text size={26} weight="bold" style={{ textAlign: "center" }}>
        {mode === "request" ? "Reset your password" : "Enter Recovery Token"}
      </Text>
      <Text color="#737781" style={{ textAlign: "center", marginTop: 8, marginBottom: 20 }}>
        {mode === "request"
          ? "Enter your email and optional daycare code to receive recovery instructions."
          : "Enter the reset token provided to set your new account password."}
      </Text>

      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#F1F0F5",
          borderRadius: 14,
          padding: 4,
          marginBottom: 18,
        }}
      >
        <Button
          title="Request Reset"
          variant={mode === "request" ? "primary" : "ghost"}
          onPress={() => {
            setMode("request");
            setMessage("");
          }}
          style={{ flex: 1, minHeight: 36 }}
        />
        <Button
          title="I Have A Token"
          variant={mode === "reset" ? "primary" : "ghost"}
          onPress={() => {
            setMode("reset");
            setMessage("");
          }}
          style={{ flex: 1, minHeight: 36 }}
        />
      </View>

      {mode === "request" ? (
        <>
          <Field
            label="Email address"
            icon={EnvelopeSimple}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="Your email address"
          />
          <Field
            label="Daycare Code (Optional)"
            placeholder="e.g. sunflower-daycare"
            autoCapitalize="none"
            value={daycareCode}
            onChangeText={setDaycareCode}
          />
          {message ? (
            <Notice tone={failed ? "error" : "success"}>{message}</Notice>
          ) : null}
          <Button
            title="Send Reset Request"
            icon={ArrowRight}
            onPress={submitRequest}
            loading={busy}
            style={{ marginTop: 8 }}
          />
        </>
      ) : (
        <>
          <Field
            label="Recovery Token"
            placeholder="Paste reset token here"
            autoCapitalize="none"
            value={token}
            onChangeText={setToken}
          />
          <Field
            label="Daycare Code (Optional)"
            placeholder="e.g. sunflower-daycare"
            autoCapitalize="none"
            value={daycareCode}
            onChangeText={setDaycareCode}
          />
          <Field
            label="New Password"
            secureTextEntry
            placeholder="At least 8 characters"
            value={newPassword}
            onChangeText={setNewPassword}
          />
          {message ? (
            <Notice tone={failed ? "error" : "success"}>{message}</Notice>
          ) : null}
          <Button
            title="Reset Password & Activate"
            icon={ArrowRight}
            onPress={submitReset}
            loading={busy}
            style={{ marginTop: 8 }}
          />
        </>
      )}
    </Page>
  );
}
