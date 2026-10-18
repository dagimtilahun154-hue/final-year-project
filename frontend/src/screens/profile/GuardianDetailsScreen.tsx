import React from "react";
import { View } from "react-native";
import { Fingerprint, Check, ShieldCheck, EnvelopeSimple } from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Badge,
  Notice,
  Button,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
import { useChild } from "../../context/ChildContext";
import { GuardianRecord } from "../../api/parentApi";

export function GuardianDetailsScreen({ navigation, route }: any) {
  const { selectedChild } = useChild();
  const guardian: GuardianRecord | undefined = route.params?.guardian;

  if (!guardian) {
    return (
      <Page title="Guardian Details" back>
        <Notice tone="error">Guardian details are currently unavailable.</Notice>
        <Button
          title="Back to Guardians"
          variant="secondary"
          onPress={() => navigation.goBack()}
          style={{ marginTop: 16 }}
        />
      </Page>
    );
  }

  const childName = selectedChild?.full_name || "Enrolled Child";
  const groupName = selectedChild?.group_name || "Early Learning";

  return (
    <Page title="Guardian Details" back tabs activeTab="Profile">
      <Card tint="#F4F5F8" style={{ alignItems: "center", paddingVertical: 24 }}>
        <Avatar
          initials={guardian.name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
          size={84}
        />
        <Text size={22} weight="semibold" style={{ marginTop: 14 }}>
          {guardian.name}
        </Text>
        <Text color="#6E7682" size={14} style={{ marginTop: 2 }}>
          {guardian.relationship || "Authorized Guardian"}
        </Text>
        <View
          style={[
            s.row,
            { marginTop: 14, flexWrap: "wrap", justifyContent: "center", gap: 8 },
          ]}
        >
          <Badge
            title={guardian.pickup_authorized ? "Pickup Authorized" : "Approval Pending"}
            tone={guardian.pickup_authorized ? "green" : "gold"}
          />
          <Badge
            title={guardian.biometric_enrolled ? "Biometric Enrolled" : "Enrollment Pending"}
            tone={guardian.biometric_enrolled ? "neutral" : "gold"}
          />
        </View>
      </Card>

      <Card style={{ marginTop: 18, padding: 16 }}>
        <View style={s.row}>
          <Avatar source={artwork.child} size={44} />
          <View style={{ marginLeft: 12 }}>
            <Text size={10} color="#8A919B" style={{ letterSpacing: 0.5 }}>
              ASSOCIATED CHILD
            </Text>
            <Text size={16} weight="medium">
              {childName} · {groupName}
            </Text>
          </View>
        </View>
      </Card>

      <Card style={{ marginTop: 18, padding: 18 }}>
        <Text size={16} weight="semibold" style={{ marginBottom: 14 }}>
          Contact Information
        </Text>
        <View style={[s.row, { marginBottom: 12 }]}>
          <EnvelopeSimple size={18} color="#6C7380" />
          <View style={{ marginLeft: 10 }}>
            <Text size={11} color="#8A919B">EMAIL ADDRESS</Text>
            <Text size={14} weight="medium">{guardian.email || "No email on record"}</Text>
          </View>
        </View>
      </Card>

      <Notice tone={guardian.biometric_enrolled ? "success" : "neutral"}>
        {guardian.biometric_enrolled
          ? "This guardian has completed biometric enrollment at the daycare kiosk and is fully approved for pickup."
          : "Biometric enrollment must be completed in-person at the daycare entrance kiosk with staff assistance."}
      </Notice>

      <Button
        title="View Pickup Status & History"
        variant="outline"
        onPress={() =>
          navigation.navigate("PickupVerification", { guardianId: guardian.guardian_link_id })
        }
        style={{ marginTop: 16 }}
      />
    </Page>
  );
}
