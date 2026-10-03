import React, { useState } from "react";
import { View, Pressable, TextInput, Platform } from "react-native";
import { User, Lock, Eye, EyeSlash, ArrowRight } from "phosphor-react-native";
import {
  Page,
  Text,
  Button,
  Field,
  BrandMark,
  Notice,
  s,
  IconButton,
} from "../../components/design/System";
import { useAuth } from "../../context/AuthContext";
export function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    setError("");
    const result = await login(email.trim(), password);
    setBusy(false);
    if (result.success) {
      if (result.role === "admin" || result.role === "caregiver") {
        if (Platform.OS === "web")
          window.location.assign(
            result.role === "admin" ? "/admin/dashboard" : "/staff/workspace",
          );
        else setError("Open the web workspace to use your staff account.");
      } else navigation.replace("MainTabs");
    } else setError(result.error || "Unable to sign in.");
  };
  return (
    <Page
      header={false}
      decorative
      contentStyle={{ paddingHorizontal: 24, paddingTop: 24 }}
    >
      <BrandMark size={38} />
      <View style={{ marginTop: 115, marginBottom: 32 }}>
        <Text size={37} weight="bold" style={{ textAlign: "center" }}>
          Welcome Back
        </Text>
        <Text color="#626872" style={{ textAlign: "center", marginTop: 8 }}>
          Sign in to stay connected to your child’s day.
        </Text>
      </View>
      <Field
        label="Email"
        icon={User}
        placeholder="Enter your email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
        autoComplete="email"
      />
      <Text weight="semibold" size={14} style={{ marginBottom: 8 }}>
        Password
      </Text>
      <View style={s.inputWrap}>
        <Lock size={21} color="#737984" />
        <TextInput
          accessibilityLabel="Password"
          placeholder="Enter your password"
          placeholderTextColor="#9295A1"
          style={s.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!visible}
          autoComplete="current-password"
          onSubmitEditing={submit}
        />
        <IconButton
          icon={visible ? Eye : EyeSlash}
          label={visible ? "Hide password" : "Show password"}
          onPress={() => setVisible(!visible)}
        />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate("ForgotPassword")}
        style={{ alignSelf: "flex-end", paddingVertical: 16 }}
      >
        <Text size={14} weight="medium">
          Forgot Password?
        </Text>
      </Pressable>
      {error ? <Notice tone="error">{error}</Notice> : null}
      <Button
        title="Sign In"
        icon={ArrowRight}
        loading={busy}
        onPress={submit}
        style={{ marginTop: 14 }}
      />
      <Text
        color="#6D727D"
        size={14}
        style={{ textAlign: "center", marginTop: 44 }}
      >
        Don’t have an account?
      </Text>
      <Text size={14} style={{ textAlign: "center", marginTop: 3 }}>
        Contact your daycare administrator.
      </Text>
      {__DEV__ && (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.replace("MainTabs")}
          style={{ alignSelf: "center", padding: 18, marginTop: 18 }}
        >
          <Text size={12} color="#747986">
            Preview design
          </Text>
        </Pressable>
      )}
      {Platform.OS === "web" && (
        <Pressable
          accessibilityRole="link"
          onPress={() => window.location.assign("/admin/login")}
          style={{ alignItems: "center", padding: 16 }}
        >
          <Text size={12} color="#687C72">
            Daycare staff workspace
          </Text>
        </Pressable>
      )}
    </Page>
  );
}
