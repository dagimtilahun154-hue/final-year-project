import React, { useState, useEffect, useCallback } from "react";
import { View, ActivityIndicator } from "react-native";
import { ShieldCheck, UserPlus, Fingerprint, Users } from "phosphor-react-native";
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
import { getChildGuardians, GuardianRecord } from "../../api/parentApi";

export function AuthorizedGuardiansScreen({ navigation }: any) {
  const { selectedChild } = useChild();
  const [guardians, setGuardians] = useState<GuardianRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadGuardians = useCallback(async () => {
    if (!selectedChild?.id) return;
    try {
      setLoading(true);
      const data = await getChildGuardians(selectedChild.id);
      setGuardians(data);
    } catch {
      // Fallback gracefully
    } finally {
      setLoading(false);
    }
  }, [selectedChild?.id]);

  useEffect(() => {
    loadGuardians();
    const unsubscribe = navigation.addListener?.("focus", loadGuardians);
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [navigation, loadGuardians]);

  const childName = selectedChild?.full_name?.split(" ")[0] || "Child";
  const groupName = selectedChild?.group_name || "Early Learning";

  return (
    <Page
      title="Authorized Guardians"
      subtitle={`Trusted adults who are authorized to pick up ${childName}.`}
      back
      tabs
      activeTab="Profile"
    >
      <Card style={{ padding: 16 }}>
        <View style={s.row}>
          <Avatar source={artwork.guardianChild} initials={childName.slice(0, 2).toUpperCase()} size={48} />
          <View style={{ marginLeft: 12 }}>
            <Text size={18} weight="semibold">
              {selectedChild?.full_name || "Child Profile"}
            </Text>
            <Text size={12} color="#828995">
              {groupName} · {selectedChild?.enrollment_status ? selectedChild.enrollment_status.toUpperCase() : "ENROLLED"}
            </Text>
          </View>
        </View>
      </Card>

      <Notice>
        Only adults verified by daycare administration and registered with biometric credentials may complete physical pickup.
      </Notice>

      {loading ? (
        <View style={{ paddingVertical: 30, alignItems: "center" }}>
          <ActivityIndicator size="small" color="#061224" />
          <Text size={13} color="#8A919B" style={{ marginTop: 10 }}>
            Loading authorized guardians…
          </Text>
        </View>
      ) : guardians.length > 0 ? (
        guardians.map((g) => (
          <Card
            key={g.guardian_link_id}
            onPress={() =>
              navigation.navigate("GuardianDetails", {
                guardian: g,
                guardianId: g.guardian_link_id,
              })
            }
            style={{ marginBottom: 14, padding: 18 }}
          >
            <View style={s.row}>
              <Avatar
                initials={g.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
                size={46}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text size={16} weight="medium">
                  {g.name}
                </Text>
                <Text size={11} color="#8A919B" style={{ letterSpacing: 0.5 }}>
                  {g.relationship ? g.relationship.toUpperCase() : "GUARDIAN"}
                </Text>
              </View>
              <Badge
                title={g.pickup_authorized ? "● Authorized" : "Pending"}
                tone={g.pickup_authorized ? "green" : "gold"}
              />
            </View>

            <View style={[s.between, { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#EDEAE4" }]}>
              <View style={s.row}>
                <Fingerprint
                  size={16}
                  color={g.biometric_enrolled ? "#2B8A3E" : "#B79D52"}
                />
                <Text
                  size={12}
                  color={g.biometric_enrolled ? "#2B8A3E" : "#B79D52"}
                  weight="medium"
                  style={{ marginLeft: 6 }}
                >
                  {g.biometric_enrolled ? "Biometric Enrolled" : "Enrollment Pending at Daycare"}
                </Text>
              </View>
              <Text size={12} color="#10263D" weight="semibold">
                Details ›
              </Text>
            </View>
          </Card>
        ))
      ) : (
        <Card style={{ padding: 24, alignItems: "center" }}>
          <Users size={40} color="#9EA3AC" />
          <Text size={16} weight="semibold" style={{ marginTop: 12 }}>
            No Guardians Registered Yet
          </Text>
          <Text size={13} color="#7D838C" style={{ marginTop: 6, textAlign: "center" }}>
            Contact the daycare office to link secondary guardians or authorized pickup delegates.
          </Text>
        </Card>
      )}

      <Button
        title="Register New Guardian"
        icon={UserPlus}
        onPress={() => navigation.navigate("AddGuardian")}
        style={{ marginTop: 8 }}
      />

      <Card tint="#F4F5F7" style={{ marginTop: 24, alignItems: "center", padding: 18 }}>
        <ShieldCheck color="#236B8E" size={28} />
        <Text weight="medium" size={15} style={{ marginTop: 10 }}>
          About Guardian Verification
        </Text>
        <Text
          size={12}
          color="#666F7C"
          style={{ textAlign: "center", marginTop: 8, lineHeight: 18 }}
        >
          Guardian pickup verification takes place on the daycare kiosk. Per child protection regulations, children's biometric data is never recorded.
        </Text>
      </Card>
    </Page>
  );
}
