import React from "react";
import { View } from "react-native";
import { ShieldCheck, UserPlus, Fingerprint } from "phosphor-react-native";
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
import { useDesign } from "../../context/DesignContext";
export function AuthorizedGuardiansScreen({ navigation }: any) {
  const { guardians } = useDesign();
  return (
    <Page
      title="Authorized Guardians"
      subtitle="Trusted adults who may pick up Liya."
      back
      tabs
      activeTab="Profile"
    >
      <Card style={{ padding: 15 }}>
        <View style={s.row}>
          <Avatar source={artwork.guardianChild} />
          <View>
            <Text size={20} weight="semibold">
              Liya
            </Text>
            <Text size={12} color="#828995">
              Sunflower Group · 4 years
            </Text>
          </View>
        </View>
      </Card>
      <Notice>
        Only approved adults can collect your child. Keep this list up to date.
      </Notice>
      {guardians.map((g) => (
        <Card
          key={g.id}
          onPress={() =>
            navigation.navigate("GuardianDetails", { guardianId: g.id })
          }
          style={{ marginBottom: 14, padding: 17 }}
        >
          <View style={s.row}>
            <Avatar
              source={g.photo ? artwork[g.photo] : undefined}
              initials={g.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
              size={46}
            />
            <View style={{ flex: 1 }}>
              <Text size={15} weight="medium">
                {g.name}
              </Text>
              <Text size={10} color="#8A919B" style={{ letterSpacing: 0.6 }}>
                {g.relationship.toUpperCase()}
              </Text>
            </View>
            <Badge
              title={g.authorized ? "● Authorized" : "Pending"}
              tone={g.authorized ? "green" : "gold"}
            />
          </View>
          <View style={[s.between, { marginTop: 20 }]}>
            <View style={s.row}>
              <Fingerprint
                size={16}
                color={g.enrolled ? "#5B9464" : "#B79D52"}
              />
              <Text size={11} color={g.enrolled ? "#5B9464" : "#B79D52"}>
                {g.enrolled ? "Biometric enrolled" : "Enrollment at daycare"}
              </Text>
            </View>
            <Text size={12} color="#3D8BA0">
              Details ›
            </Text>
          </View>
        </Card>
      ))}
      <Button
        title="Add Guardian"
        icon={UserPlus}
        onPress={() => navigation.navigate("AddGuardian")}
        style={{ marginTop: 10 }}
      />
      <Card tint="#F2F2F5" style={{ marginTop: 26, alignItems: "center" }}>
        <ShieldCheck color="#4196AC" size={28} />
        <Text weight="medium" style={{ marginTop: 10 }}>
          About Guardian Verification
        </Text>
        <Text
          size={12}
          color="#777F8C"
          style={{ textAlign: "center", marginTop: 9 }}
        >
          Verification takes place at the daycare. Children’s biometrics are
          never collected.
        </Text>
      </Card>
    </Page>
  );
}
