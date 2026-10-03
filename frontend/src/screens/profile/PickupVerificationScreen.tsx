import React from "react";
import { View } from "react-native";
import { ShieldCheck, Fingerprint, House, Check } from "phosphor-react-native";
import {
  Page,
  Text,
  Card,
  Avatar,
  Badge,
  Notice,
  s,
} from "../../components/design/System";
import { artwork } from "../../theme/assets";
import { useDesign } from "../../context/DesignContext";
import { pickupSteps } from "../../utils/pickup";

export function PickupVerificationScreen({ route }: any) {
  const { guardians } = useDesign();
  const guardian = guardians.find(
    (g) => g.id === (route.params?.guardianId ?? 1),
  );
  if (!guardian)
    return (
      <Page title="Pickup Status" back>
        <Notice>This guardian is unavailable.</Notice>
      </Page>
    );
  // Preview has no verification or checkout event. Enrollment is not a pickup event.
  const states = pickupSteps(guardian.authorized);
  const steps = [
    {
      title: "Guardian authorized",
      detail: guardian.authorized
        ? "Approved to collect Liya."
        : "Awaiting daycare approval.",
      Icon: ShieldCheck,
    },
    {
      title: "Identity verified",
      detail: "Front-desk staff verify identity at pickup.",
      Icon: Fingerprint,
    },
    {
      title: "Checked out",
      detail: "Staff confirm when Liya leaves daycare.",
      Icon: House,
    },
  ];
  return (
    <Page title="Pickup Status" back tabs activeTab="Profile">
      <Card tint="#F1F5EC">
        <View style={[s.row, { flexWrap: "wrap" }]}>
          <Avatar source={artwork.child} size={58} />
          <View style={{ flex: 1, minWidth: 80 }}>
            <Text size={21} weight="semibold">
              Liya
            </Text>
            <Text size={12} color="#687C72">
              Sunflower Group
            </Text>
          </View>
          <Badge title="At daycare" />
        </View>
      </Card>
      <Card style={{ marginTop: 18, padding: 22 }}>
        <View
          style={[s.between, { marginBottom: 24, flexWrap: "wrap", gap: 8 }]}
        >
          <Text size={19} weight="semibold">
            Pickup journey
          </Text>
          <Badge title="Preview" tone="neutral" />
        </View>
        {steps.map(({ title, detail, Icon }, index) => {
          const state = states[index];
          const complete = state === "complete";
          const current = state === "current";
          const ink = complete ? "#3D795A" : current ? "#8A6A25" : "#7C8490";
          return (
            <View key={title} style={{ flexDirection: "row", gap: 16 }}>
              <View style={{ width: 42, alignItems: "center" }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: complete
                      ? "#E8F3E9"
                      : current
                        ? "#FFF2CC"
                        : "#F2F1F3",
                    borderWidth: current ? 1.5 : 0,
                    borderColor: "#D1B366",
                  }}
                >
                  {complete ? (
                    <Check size={22} color={ink} weight="bold" />
                  ) : (
                    <Icon size={22} color={ink} />
                  )}
                </View>
                {index < steps.length - 1 && (
                  <View
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 42,
                      backgroundColor: complete ? "#AECDB6" : "#E9E7EA",
                      marginVertical: 5,
                    }}
                  />
                )}
              </View>
              <View
                style={{
                  flex: 1,
                  paddingTop: 2,
                  paddingBottom: index < 2 ? 28 : 0,
                }}
              >
                <Text size={15} weight="semibold">
                  {title}
                </Text>
                <Text
                  size={12}
                  color="#727E89"
                  style={{ marginTop: 5, lineHeight: 19 }}
                >
                  {detail}
                </Text>
                <Text
                  size={11}
                  weight="semibold"
                  color={ink}
                  style={{ marginTop: 8 }}
                >
                  {complete
                    ? "Complete"
                    : current
                      ? "Awaiting staff"
                      : "Waiting"}
                </Text>
              </View>
            </View>
          );
        })}
      </Card>
      <Card style={{ marginTop: 18 }}>
        <View style={s.row}>
          <Avatar
            source={guardian.photo ? artwork[guardian.photo] : undefined}
          />
          <View style={{ flex: 1 }}>
            <Text size={11} color="#727E89">
              PICKUP GUARDIAN
            </Text>
            <Text weight="semibold" style={{ marginTop: 4 }}>
              {guardian.name}
            </Text>
            <Text size={12} color="#727E89" style={{ marginTop: 3 }}>
              {guardian.relationship}
            </Text>
          </View>
        </View>
      </Card>
      <Notice>
        {guardian.authorized
          ? "Authorized staff complete verification and check-out at the front desk."
          : "This guardian must be approved by daycare staff before pickup."}
      </Notice>
    </Page>
  );
}
