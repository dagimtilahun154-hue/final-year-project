import React, { useState } from "react";
import { View } from "react-native";
import { Fingerprint, Check } from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Badge,
  Field,
  Notice,
  Button,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
import { useDesign } from "../../context/DesignContext";
import { contactError } from "../../utils/contact";
export function GuardianDetailsScreen({ navigation, route }: any) {
  const { guardians, saveGuardian } = useDesign();
  const guardian = guardians.find((g) => g.id === route.params?.guardianId);
  const [phone, setPhone] = useState(guardian?.phone || "");
  const [email, setEmail] = useState(guardian?.email || "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  if (!guardian)
    return (
      <Page title="Guardian Details" back>
        <Notice>This guardian is unavailable.</Notice>
      </Page>
    );
  return (
    <Page title="Guardian Details" back tabs activeTab="Profile">
      <Card tint="#F1F0F5" style={{ alignItems: "center" }}>
        <Avatar
          source={guardian.photo ? artwork[guardian.photo] : undefined}
          initials={guardian.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
          size={86}
        />
        <Text size={21} weight="semibold" style={{ marginTop: 16 }}>
          {guardian.name}
        </Text>
        <Text color="#777E88" size={14}>
          {guardian.relationship}
        </Text>
        <View
          style={[
            s.row,
            { marginTop: 14, flexWrap: "wrap", justifyContent: "center" },
          ]}
        >
          <Badge
            title={guardian.authorized ? "Authorized" : "Pending approval"}
            tone={guardian.authorized ? "green" : "gold"}
          />
          {guardian.enrolled && (
            <Badge title="Biometric enrolled" tone="neutral" />
          )}
        </View>
      </Card>
      <Card style={{ marginTop: 20 }}>
        <View style={s.row}>
          <Avatar source={artwork.child} size={44} />
          <View>
            <Text size={10} color="#90959E">
              ASSOCIATED CHILD
            </Text>
            <Text>Liya · Sunflower Group</Text>
          </View>
        </View>
      </Card>
      <Card style={{ marginTop: 20 }}>
        <Field
          label="Phone Number"
          value={phone}
          onChangeText={(value) => {
            setPhone(value);
            setSaved(false);
            setError("");
          }}
          keyboardType="phone-pad"
        />
        <Field
          label="Email Address"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setSaved(false);
            setError("");
          }}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Card>
      <Notice>
        {guardian.enrolled
          ? "Adult guardian verification is completed at the daycare."
          : guardian.authorized
            ? "Daycare staff can arrange adult verification."
            : "Daycare approval is required before this guardian can collect Liya."}{" "}
        Children’s biometrics are never used.
      </Notice>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {saved && <Notice tone="success">Changes saved for this preview.</Notice>}
      <Button
        title="Save Draft"
        icon={Check}
        onPress={() => {
          const problem = contactError(guardian.name, phone, email);
          if (problem) {
            setError(problem);
            return;
          }
          setError("");
          saveGuardian({
            ...guardian,
            phone: phone.trim(),
            email: email.trim(),
          });
          setSaved(true);
        }}
        style={{ marginTop: 18 }}
      />
      <Button
        title="View Pickup Status"
        variant="outline"
        onPress={() =>
          navigation.navigate("PickupVerification", { guardianId: guardian.id })
        }
        style={{ marginTop: 12 }}
      />
    </Page>
  );
}
