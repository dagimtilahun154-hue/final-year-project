import React, { useState } from "react";
import { View, Pressable, TextInput, Platform, Linking } from "react-native";
import {
  Lock,
  Eye,
  EyeSlash,
  ArrowRight,
  ArrowLeft,
  House,
  EnvelopeSimple,
  ShieldCheck,
} from "phosphor-react-native";
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

export function LoginScreen({ navigation, route }: any) {
  const { login, verifyMfa } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [daycareCode, setDaycareCode] = useState("");
  const [showDaycareCode, setShowDaycareCode] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // MFA Challenge State
  const [mfaChallenge, setMfaChallenge] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const handleSignIn = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }
    if (password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    setBusy(true);
    setError("");
    const result = await login(trimmedEmail, password, daycareCode);
    setBusy(false);

    if (result.mfaRequired && result.challengeToken) {
      setMfaChallenge(result.challengeToken);
      return;
    }

    if (result.success) {
      handlePostLoginRedirect(result);
    } else {
      setError(result.error || "Unable to sign in. Please check your credentials.");
    }
  };

  const handleVerifyMfa = async () => {
    if (!totpCode || totpCode.trim().length < 6) {
      setError("Please enter the 6-digit authentication code.");
      return;
    }

    setBusy(true);
    setError("");
    const result = await verifyMfa(mfaChallenge!, totpCode.trim());
    setBusy(false);

    if (result.success) {
      handlePostLoginRedirect(result);
    } else {
      setError(result.error || "Invalid authentication code. Please try again.");
    }
  };

  const handlePostLoginRedirect = async (result: any) => {
    if (result.role === "super_admin") {
      if (Platform.OS === "web") {
        window.location.assign("/super-admin");
      } else {
        const url = "http://192.168.8.114:8081/super-admin";
        try {
          await Linking.openURL(url);
        } catch {
          setError(`Super Admin Console is web-based. Open ${url} in your browser.`);
        }
      }
      return;
    }
    if (result.role === "admin" || result.role === "caregiver") {
      const targetPath = result.role === "admin" ? "/admin" : "/staff";
      if (Platform.OS === "web") {
        window.location.assign(targetPath);
      } else {
        const url = `http://192.168.8.114:8081${targetPath}`;
        try {
          await Linking.openURL(url);
        } catch {
          setError(`Please open ${url} in your phone browser.`);
        }
      }
    } else if (result.profileComplete === false) {
      navigation.replace("ChildProfileWizard");
    } else {
      navigation.replace("MainTabs");
    }
  };

  if (route?.params?.mode === "register") {
    return <RegisterScreen navigation={navigation} />;
  }

  return (
    <Page
      header={false}
      decorative
      contentStyle={{ paddingHorizontal: 24, paddingTop: 24 }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to First Page / Welcome"
          onPress={() => navigation.navigate("Splash")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 16,
            backgroundColor: "#F0EEF0",
          }}
        >
          <ArrowLeft size={15} color="#061224" weight="bold" />
          <Text size={12} weight="bold" color="#061224">
            First Page
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to Home Feed"
          onPress={() => navigation.navigate("MainTabs")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderRadius: 16,
            backgroundColor: "#EBF3FF",
          }}
        >
          <House size={15} color="#061224" weight="bold" />
          <Text size={12} weight="bold" color="#061224">
            Home Feed
          </Text>
        </Pressable>

        <BrandMark size={32} />
      </View>

      <View style={{ marginTop: 40, marginBottom: 24, alignItems: "center" }}>
        <Text size={32} weight="bold" style={{ textAlign: "center", color: "#10263D" }}>
          Welcome Back
        </Text>
        <Text color="#626872" size={14} style={{ textAlign: "center", marginTop: 8, maxWidth: 300 }}>
          Sign in to stay connected with your child’s daily daycare updates.
        </Text>
      </View>

      {/* MFA Challenge View */}
      {mfaChallenge ? (
        <View style={{ marginBottom: 20 }}>
          <Notice tone="info">
            Two-Factor Authentication is enabled for your account. Please enter the 6-digit code from your authenticator app or your recovery code.
          </Notice>
          <View style={{ marginTop: 14 }}>
            <Field
              label="6-Digit Auth Code or Recovery Key"
              icon={ShieldCheck}
              placeholder="e.g. 123456"
              value={totpCode}
              onChangeText={(v) => {
                setTotpCode(v);
                setError("");
              }}
              keyboardType="number-pad"
              autoFocus
            />
            {error ? (
              <View style={{ marginBottom: 14 }}>
                <Notice tone="error">{error}</Notice>
              </View>
            ) : null}
            <Button
              title={busy ? "Verifying…" : "Verify Code"}
              loading={busy}
              onPress={handleVerifyMfa}
              style={{ marginTop: 8 }}
            />
            <Button
              title="Cancel & Sign In With Another Account"
              variant="ghost"
              onPress={() => {
                setMfaChallenge(null);
                setTotpCode("");
                setError("");
              }}
              style={{ marginTop: 10 }}
            />
          </View>
        </View>
      ) : (
        <>
          {/* Email Field */}
          <Field
            label="Email Address"
            icon={EnvelopeSimple}
            placeholder="Enter your email address"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              setError("");
            }}
            autoComplete="email"
          />

          {/* Password Field */}
          <Text weight="semibold" size={14} style={{ marginBottom: 8 }}>
            Password
          </Text>
          <View style={[s.inputWrap, { marginBottom: 12 }]}>
            <Lock size={20} color="#737984" />
            <TextInput
              accessibilityLabel="Password"
              placeholder="Enter your password"
              placeholderTextColor="#9295A1"
              style={s.input}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError("");
              }}
              secureTextEntry={!visible}
              autoComplete="current-password"
              onSubmitEditing={handleSignIn}
            />
            <IconButton
              icon={visible ? Eye : EyeSlash}
              label={visible ? "Hide password" : "Show password"}
              onPress={() => setVisible(!visible)}
            />
          </View>

          {/* Daycare Code Toggle */}
          {showDaycareCode ? (
            <Field
              label="Daycare Code / Slug"
              icon={House}
              placeholder="e.g. sunflower-daycare"
              autoCapitalize="none"
              value={daycareCode}
              onChangeText={(v) => {
                setDaycareCode(v);
                setError("");
              }}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowDaycareCode(true)}
              style={{ alignSelf: "flex-start", marginBottom: 14 }}
            >
              <Text size={12} weight="medium" color="#2F80ED">
                + Sign in with Daycare Code
              </Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("ForgotPassword")}
            style={{ alignSelf: "flex-end", marginBottom: 16 }}
          >
            <Text size={13} weight="medium" color="#4D5663">
              Forgot Password?
            </Text>
          </Pressable>

          {/* Error Banner */}
          {error ? (
            <View style={{ marginBottom: 16 }}>
              <Notice tone="error">{error}</Notice>
            </View>
          ) : null}

      {/* Primary Action Button */}
      <Button
        title={busy ? "Signing In…" : "Sign In"}
        icon={busy ? undefined : ArrowRight}
        loading={busy}
        onPress={handleSignIn}
        style={{ marginTop: 8 }}
      />

      <View style={{ marginTop: 28, alignItems: "center" }}>
        <Text size={13} color="#6D727D" style={{ textAlign: "center" }}>
          Parent accounts are created by your daycare administrator.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Register")}
          style={{ padding: 8 }}
        >
          <Text size={13} weight="bold" color="#10263D">How to get access</Text>
        </Pressable>
      </View>
      </>
      )}

      {/* Staff Portal Link */}
      <Pressable
        accessibilityRole="link"
        onPress={() => {
          if (Platform.OS === "web") {
            window.location.assign("/admin");
          } else {
            Linking.openURL("http://192.168.8.114:8081/admin");
          }
        }}
        style={{
          alignItems: "center",
          paddingVertical: 10,
          paddingHorizontal: 16,
          marginTop: 14,
          borderRadius: 20,
          backgroundColor: "#E8F6F3",
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <ShieldCheck size={16} color="#008794" weight="bold" />
          <Text size={13} weight="bold" color="#008794">
            Daycare Staff & Admin Portal →
          </Text>
        </View>
      </Pressable>
    </Page>
  );
}

export function RegisterScreen({ navigation }: any) {
  return (
    <Page header={false} decorative contentStyle={{ paddingHorizontal: 24, paddingTop: 60 }}>
      <BrandMark size={48} />
      <Text size={28} weight="bold" style={{ marginTop: 24, marginBottom: 16 }}>
        Join your daycare
      </Text>
      <Notice>
        Your daycare administrator creates your parent account and links your children.
        Contact the daycare office to request access or enroll another child.
      </Notice>
      <Text color="#626872" style={{ marginTop: 20, marginBottom: 24 }}>
        Use the sign-in details provided by your daycare. If your children attend different
        daycares, each daycare manages a separate account for you.
      </Text>
      <Button title="Back to sign in" icon={ArrowRight} onPress={() => navigation.replace("Login", { mode: "signin" })} />
    </Page>
  );
}
