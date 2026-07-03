import { recommendTeeShot } from "./src/domain/teeRecommendation";
import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { distanceMeters } from "./src/domain/distance";
import { defaultProfile } from "./src/data/defaultProfile";
import { sampleCourses } from "./src/data/sampleCourse";
import { recommendClub } from "./src/domain/clubRecommendation";
import { teeSummary } from "./src/domain/holeStrategy";
import { planShot } from "./src/domain/shotPlanner";
import { analyzeRound } from "./src/domain/roundAnalysis";
import { Club, GeoPoint, HoleScore, Lie, PlayerProfile, RoundShot, ShotOutcome, WeatherSnapshot } from "./src/domain/types";
import { getCurrentPosition, findNearestCourse } from "./src/services/location";
import { fetchOpenMeteoWeather } from "./src/services/weatherOpenMeteo";
import { loadJson, saveJson } from "./src/services/storage";
import { speak } from "./src/services/speech";

const PROFILE_KEY = "ai-caddie.profile.v1";
const SHOTS_KEY = "ai-caddie.shots.v1";
const SCORES_KEY = "ai-caddie.scores.v1";
const LIES: Lie[] = ["tee", "fairway", "rough", "sand", "green", "recovery"];
const OUTCOMES: ShotOutcome[] = ["fairway", "green", "right", "left", "short", "long", "bunker", "penalty", "putt", "other"];
type SelectOption<T extends string> = {
  label: string;
  value: T;
};

const LIE_OPTIONS: SelectOption<Lie>[] = [
  { label: "Tee", value: "tee" },
  { label: "Fairway", value: "fairway" },
  { label: "Rough", value: "rough" },
  { label: "Sand", value: "sand" },
  { label: "Green", value: "green" },
  { label: "Recovery / problem", value: "recovery" },
];

const OUTCOME_OPTIONS: SelectOption<ShotOutcome>[] = [
  { label: "Fairway", value: "fairway" },
  { label: "Green", value: "green" },
  { label: "Miss höger", value: "right" },
  { label: "Miss vänster", value: "left" },
  { label: "Kort", value: "short" },
  { label: "Lång", value: "long" },
  { label: "Bunker", value: "bunker" },
  { label: "Plikt / penalty", value: "penalty" },
  { label: "Putt", value: "putt" },
  { label: "Annat", value: "other" },
];

const DOMINANT_MISS_OPTIONS: SelectOption<PlayerProfile["dominantMiss"]>[] = [
  { label: "Ofta höger", value: "right" },
  { label: "Ofta vänster", value: "left" },
  { label: "Ofta kort", value: "short" },
  { label: "Ofta lång", value: "long" },
  { label: "Blandat", value: "mixed" },
];

type Tab = "setup" | "round" | "analysis";

function nextInList<T>(items: T[], current: T): T {
  const index = items.indexOf(current);
  return items[(index + 1) % items.length];
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

export default function App() { 
  const [tab, setTab] = useState<Tab>("round");
  const [profile, setProfile] = useState<PlayerProfile>(defaultProfile);
  const [course, setCourse] = useState(sampleCourses[0]);
  const [currentHoleNumber, setCurrentHoleNumber] = useState(1);
  const [targetDistance, setTargetDistance] = useState(String(sampleCourses[0].holes[0].meters));
  const [lie, setLie] = useState<Lie>("tee");
  const [outcome, setOutcome] = useState<ShotOutcome>("fairway");
  const [weather, setWeather] = useState<WeatherSnapshot | undefined>();
  const [shots, setShots] = useState<RoundShot[]>([]);
  const [scores, setScores] = useState<HoleScore[]>([]);
  const [scoreInput, setScoreInput] = useState("");
  const [currentBallPosition, setCurrentBallPosition] = useState<GeoPoint | undefined>(
    sampleCourses[0].holes[0].tee,
  );
  const [status, setStatus] = useState("Demo course loaded. Add your club lengths and start logging shots.");

  useEffect(() => {
    void loadJson<PlayerProfile>(PROFILE_KEY, defaultProfile).then(setProfile);
    void loadJson<RoundShot[]>(SHOTS_KEY, []).then(setShots);
    void loadJson<HoleScore[]>(SCORES_KEY, []).then(setScores);
  }, []);

  useEffect(() => {
    void saveJson(PROFILE_KEY, profile);
  }, [profile]);

  useEffect(() => {
    void saveJson(SHOTS_KEY, shots);
  }, [shots]);

  useEffect(() => {
  void saveJson(SCORES_KEY, scores);
  }, [scores]);

  const hole = course.holes.find((h) => h.number === currentHoleNumber) ?? course.holes[0];

  const distanceToGreenMeters = useMemo(() => {
    const meters = Number(targetDistance);
    return Number.isFinite(meters) && meters > 0 ? meters : hole.meters;
  }, [targetDistance, hole.meters]);

  const teeRecommendation = useMemo(() => {
  return recommendTeeShot({
    profile,
    hole,
    weather,
  });
}, [profile, hole, weather]);

  const approachRecommendation = useMemo(() => {
    return recommendClub({
      profile,
      targetDistanceMeters: distanceToGreenMeters,
      lie,
      weather,
    });
  }, [profile, distanceToGreenMeters, lie, weather]);

  const shotPlan = useMemo(() => {
    if (lie === "tee") return undefined;

    return planShot({
      profile,
      hole,
      lie,
      distanceToGreenMeters,
      weather,
    });
  }, [profile, hole, lie, distanceToGreenMeters, weather]);

  const recommendation = lie === "tee" ? teeRecommendation : approachRecommendation;
  const analysis = useMemo(() => analyzeRound(shots), [shots]);

  
  function updateClub(clubId: string, patch: Partial<Club>) {
    setProfile((current) => ({
      ...current,
      clubs: current.clubs.map((club) => (club.id === clubId ? { ...club, ...patch } : club)),
    }));
  }

  function getDistanceToHoleTarget(position: GeoPoint, holeData = hole): number | undefined {
  if (!holeData.greenCenter) return undefined;
  return Math.max(0, Math.round(distanceMeters(position, holeData.greenCenter)));
}

  async function locateAndFetchWeather() {
  try {
    setStatus("Checking GPS and weather...");
    const position = await getCurrentPosition();
    if (!position) {
      setStatus("Location permission was not granted. Demo course remains active.");
      return;
    }

    const nearest = findNearestCourse(position, sampleCourses, 10000);
    if (nearest) {
      setCourse(nearest);

      const activeHole =
        nearest.holes.find((h) => h.number === currentHoleNumber) ?? nearest.holes[0];

      setCurrentBallPosition(position);

      const distanceToActiveGreen = getDistanceToHoleTarget(position, activeHole);

      if (typeof distanceToActiveGreen === "number") {
        setTargetDistance(String(distanceToActiveGreen));
      } else {
        setTargetDistance(String(activeHole.meters));
      }
    }

    const fetchedWeather = await fetchOpenMeteoWeather(position.latitude, position.longitude);
    setWeather(fetchedWeather);
    setStatus(`GPS active. Weather updated${nearest ? ` near ${nearest.name}` : ""}.`);
  } catch (error) {
    console.warn(error);
    setStatus("Could not fetch GPS/weather. The app still works in manual mode.");
  }
}

async function markCurrentBallPosition() {
  try {
    setStatus("Reading GPS position...");
    const position = await getCurrentPosition();

    if (!position) {
      setStatus("Could not read GPS position.");
      return;
    }

    setCurrentBallPosition(position);

    const autoDistance = getDistanceToHoleTarget(position);
    if (typeof autoDistance === "number") {
      setTargetDistance(String(autoDistance));
      setStatus(`Ball position marked. About ${autoDistance} m to green center.`);
    } else {
      setStatus("Ball position marked from GPS.");
    }
  } catch (error) {
    console.warn(error);
    setStatus("Could not mark current GPS position.");
  }
}

  async function addShotFromGps() {
  try {
    const shotNumber = shots.filter((shot) => shot.holeNumber === currentHoleNumber).length + 1;
    const selectedOption = lie === "tee" ? undefined : shotPlan?.recommendedOption;

    const startPosition = currentBallPosition ?? hole.tee;

    if (!startPosition) {
      setStatus("No start position found. Mark your current tee/ball position first.");
      return;
    }

    setStatus("Reading GPS for shot end position...");
    const endPosition = await getCurrentPosition();

    if (!endPosition) {
      setStatus("Could not read GPS for shot end position.");
      return;
    }

    const measuredDistanceMeters = Math.max(
      0,
      Math.round(distanceMeters(startPosition, endPosition))
    );

    const shot: RoundShot = {
      id: generateId("shot"),
      holeNumber: currentHoleNumber,
      shotNumber,
      clubName:
        lie === "tee"
          ? teeRecommendation.club?.name ?? "Manual"
          : selectedOption?.clubName ?? recommendation.club?.name ?? "Manual",
      lie,
      intent:
        lie === "tee"
          ? "tee"
          : selectedOption?.intent ?? (lie === "green" ? "putt" : "attack_green"),
      outcome,
      plannedDistanceMeters:
        lie === "tee"
          ? teeRecommendation.targetDistanceMeters
          : selectedOption?.targetDistanceMeters ?? recommendation.targetDistanceMeters,
      measuredDistanceMeters,
      startPosition,
      endPosition,
      position: endPosition,
      createdAtIso: new Date().toISOString(),
      note:
        lie === "tee"
          ? teeRecommendation.message
          : selectedOption?.message ?? recommendation.message,
    };

    setShots((current) => [...current, shot]);
    setCurrentBallPosition(endPosition);

    const autoDistance =
      getDistanceToHoleTarget(endPosition) ??
      Math.max(0, Math.round(distanceToGreenMeters - measuredDistanceMeters));

    setTargetDistance(String(autoDistance));

    if (outcome === "green" || outcome === "putt") {
      setLie("green");
    } else if (outcome === "fairway") {
      setLie("fairway");
    } else if (outcome === "bunker") {
      setLie("sand");
    } else if (
      outcome === "right" ||
      outcome === "left" ||
      outcome === "short" ||
      outcome === "long"
    ) {
      setLie("rough");
    }

    setStatus(
      `Logged shot ${shotNumber}: ${shot.clubName}, ${measuredDistanceMeters} m. About ${autoDistance} m remaining.`
    );
  } catch (error) {
    console.warn(error);
    setStatus("Could not save shot from GPS.");
  }
}

  function speakCurrentPlan() {
    if (lie === "tee") {
      const summary = teeSummary(hole, profile);
      speak(`${summary} ${teeRecommendation.message}`);
      return;
    }

    if (shotPlan) {
      speak(`${shotPlan.summary} Rekommendation: ${shotPlan.recommendedOption.message}`);
      return;
    }

    speak(recommendation.message);
  }

  function nextHole(delta: number) {
  const holeNumbers = course.holes.map((h) => h.number);
  const index = holeNumbers.indexOf(currentHoleNumber);
  const nextIndex = Math.min(Math.max(index + delta, 0), holeNumbers.length - 1);
  const nextNumber = holeNumbers[nextIndex];
  const nextHoleData = course.holes.find((h) => h.number === nextNumber);

  setCurrentHoleNumber(nextNumber);
  setLie("tee");
  setOutcome("fairway");
  setCurrentBallPosition(nextHoleData?.tee);

  if (nextHoleData?.tee && nextHoleData.greenCenter) {
    setTargetDistance(String(Math.round(distanceMeters(nextHoleData.tee, nextHoleData.greenCenter))));
  } else {
    setTargetDistance(String(nextHoleData?.meters ?? ""));
  }
}

function submitHoleScore() {
  const strokes = Number(scoreInput);

  if (!Number.isFinite(strokes) || strokes <= 0) {
    setStatus("Ange ett giltigt score för hålet.");
    return;
  }

  const score: HoleScore = {
    holeNumber: currentHoleNumber,
    par: hole.par,
    strokes,
    createdAtIso: new Date().toISOString(),
  };

  setScores((current) => [
    ...current.filter((item) => item.holeNumber !== currentHoleNumber),
    score,
  ]);

  const holeNumbers = course.holes.map((h) => h.number);
  const index = holeNumbers.indexOf(currentHoleNumber);
  const nextHoleNumber = holeNumbers[index + 1];

  setScoreInput("");

  if (!nextHoleNumber) {
    setStatus("Score sparat. Rundan är klar.");
    return;
  }

  const nextHoleData = course.holes.find((h) => h.number === nextHoleNumber);

  setCurrentHoleNumber(nextHoleNumber);
  setLie("tee");
  setOutcome("fairway");
  setCurrentBallPosition(nextHoleData?.tee);

  if (nextHoleData?.tee && nextHoleData.greenCenter) {
    setTargetDistance(String(Math.round(distanceMeters(nextHoleData.tee, nextHoleData.greenCenter))));
  } else {
    setTargetDistance(String(nextHoleData?.meters ?? ""));
  }

  setStatus(`Score sparat. Nu spelar du hål ${nextHoleNumber}.`);
}

  function resetRound() {
    Alert.alert("Reset round", "Clear all logged shots on this phone?", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: () => setShots([]) },
    ]);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="auto" />
      <View style={styles.header}>
        <Text style={styles.title}>AI Caddie Starter</Text>
        <Text style={styles.subtitle}>{course.name}</Text>
      </View>

      <View style={styles.tabs}>
        <TabButton label="Setup" active={tab === "setup"} onPress={() => setTab("setup")} />
        <TabButton label="Round" active={tab === "round"} onPress={() => setTab("round")} />
        <TabButton label="Analysis" active={tab === "analysis"} onPress={() => setTab("analysis")} />
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.content}>
        <Text style={styles.status}>{status}</Text>

        {tab === "setup" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>1. Player profile</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={profile.name}
              onChangeText={(name) => setProfile((current) => ({ ...current, name }))}
            />
            <Text style={styles.label}>Dominant miss</Text>
            <Dropdown
              title="Välj vanlig miss"
              value={profile.dominantMiss}
              options={DOMINANT_MISS_OPTIONS}
              onChange={(dominantMiss) => setProfile((current) => ({ ...current, dominantMiss }))}
            />

            <Text style={styles.sectionTitle}>2. Club lengths</Text>
            {profile.clubs.map((club) => (
              <View key={club.id} style={styles.clubRow}>
                <Text style={styles.clubName}>{club.name}</Text>
                <TextInput
                  style={styles.smallInput}
                  keyboardType="numeric"
                  value={String(club.carryMeters)}
                  onChangeText={(value) => updateClub(club.id, { carryMeters: Number(value) || 0 })}
                />
                <Text style={styles.muted}>carry m</Text>
              </View>
            ))}
          </View>
        )}

        {tab === "round" && (
          <View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Hole {hole.number}</Text>
              <Text style={styles.bigText}>Par {hole.par} - {hole.meters} m</Text>
              <Text style={styles.muted}>{teeSummary(hole, profile)}</Text>

              <View style={styles.rowGap}>
                <Button label="Prev hole" onPress={() => nextHole(-1)} />
                <Button label="Next hole" onPress={() => nextHole(1)} />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Shot recommendation</Text>
              <Text style={styles.label}>Distance to target / pin / safe landing area</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={targetDistance}
                onChangeText={setTargetDistance}
              />

              <Text style={styles.label}>Lie</Text>
              <Dropdown
                title="Välj lie"
                value={lie}
                options={LIE_OPTIONS}
                onChange={setLie}
              />

              {lie === "tee" ? (
                <>
                  <Text style={styles.recommendation}>{teeRecommendation.message}</Text>
                  {teeRecommendation.factors.map((factor) => (
                    <Text key={factor} style={styles.factor}>
                      - {factor}
                    </Text>
                  ))}
                </>
              ) : shotPlan ? (
                <>
                  <Text style={styles.recommendation}>{shotPlan.headline}</Text>
                  <Text style={styles.muted}>{shotPlan.summary}</Text>

                  {shotPlan.options.map((option) => (
                    <View
                      key={`${option.kind}-${option.label}`}
                      style={[styles.planCard, option.recommended && styles.planCardRecommended]}
                    >
                      <Text style={styles.planTitle}>
                        {option.recommended ? "Recommended: " : "Alternative: "}
                        {option.label}
                      </Text>
                      <Text style={styles.planClub}>
                        {option.clubName} • {Math.round(option.targetDistanceMeters)} m
                      </Text>

                      {typeof option.requiredCarryMeters === "number" && (
                        <Text style={styles.muted}>
                          Carry needed: about {Math.round(option.requiredCarryMeters)} m
                        </Text>
                      )}

                      <Text style={styles.muted}>{option.message}</Text>
                      <Text style={styles.muted}>
                        Risk {option.riskScore}/10 • Reward {option.rewardScore}/10 • Leaves about{" "}
                        {Math.round(option.expectedRemainingMeters)} m
                      </Text>
                      {option.explanation.map((line) => (
                        <Text key={`${option.kind}-${option.clubName}-${line}`} style={styles.factor}>
                          - {line}
                        </Text>
                      ))}
                    </View>
                  ))}
                </>
              ) : (
                <>
                  <Text style={styles.recommendation}>{recommendation.message}</Text>
                  {recommendation.factors.map((factor) => (
                    <Text key={factor} style={styles.factor}>
                      - {factor}
                    </Text>
                  ))}
                </>
              )}

              <View style={styles.rowGap}>
                <Button label="GPS + weather" onPress={locateAndFetchWeather} />
                <Button label="Read aloud" onPress={speakCurrentPlan} />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Log shot</Text>
              <Text style={styles.label}>Outcome</Text>
              <Dropdown
                title="Välj resultat"
                value={outcome}
                options={OUTCOME_OPTIONS}
                onChange={setOutcome}
              />
              <Text style={styles.muted}>
              Current ball position:{" "}
              {currentBallPosition
               ? `${currentBallPosition.latitude.toFixed(5)}, ${currentBallPosition.longitude.toFixed(5)}`
               : "not set"}
              </Text>
              <View style={styles.rowGap}>
              <Button label="Mark current position" onPress={markCurrentBallPosition} />
              <Button label="Save shot from GPS" onPress={addShotFromGps} />
            </View>
              <Text style={styles.muted}>Shots this hole: {shots.filter((shot) => shot.holeNumber === currentHoleNumber).length}</Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Score</Text>

              <Text style={styles.label}>Score för hål {hole.number}</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={scoreInput}
                onChangeText={setScoreInput}
                placeholder={`Par ${hole.par}`}
              />

              <View style={styles.rowGap}>
                <Button label="Spara score och gå vidare" onPress={submitHoleScore} />
              </View>

              <Text style={styles.muted}>
                Sparat score:{" "}
                {scores.find((score) => score.holeNumber === hole.number)?.strokes ?? "inte inskrivet"}
              </Text>
            </View>
          </View>
        )}

        {tab === "analysis" && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Round analysis</Text>
            <Text style={styles.recommendation}>{analysis.mainFinding}</Text>
            <Metric label="Total shots" value={analysis.totalShots} />
            <Metric label="Fairways" value={analysis.fairways} />
            <Metric label="Greens" value={analysis.greens} />
            <Metric label="Putts" value={analysis.putts} />
            <Metric label="Miss right" value={analysis.missesRight} />
            <Metric label="Miss left" value={analysis.missesLeft} />
            <Metric label="Short" value={analysis.missesShort} />
            <Metric label="Long" value={analysis.missesLong} />
            <Metric label="Penalties" value={analysis.penalties} />
            <Button label="Reset round" onPress={resetRound} danger />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function TabButton(props: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.tab, props.active && styles.tabActive]} onPress={props.onPress}>
      <Text style={[styles.tabText, props.active && styles.tabTextActive]}>{props.label}</Text>
    </TouchableOpacity>
  );
}

function Dropdown<T extends string>(props: {
  title: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}) {
  const [visible, setVisible] = useState(false);
  const selected = props.options.find((option) => option.value === props.value);

  return (
    <>
      <TouchableOpacity style={styles.dropdownButton} onPress={() => setVisible(true)}>
        <Text style={styles.dropdownButtonText}>{selected?.label ?? props.value}</Text>
        <Text style={styles.dropdownChevron}>▼</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{props.title}</Text>

            {props.options.map((option) => {
              const active = option.value === props.value;

              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.optionRow, active && styles.optionRowActive]}
                  onPress={() => {
                    props.onChange(option.value);
                    setVisible(false);
                  }}
                >
                  <Text style={[styles.optionText, active && styles.optionTextActive]}>
                    {option.label}
                  </Text>
                  {active && <Text style={styles.optionCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

function Button(props: { label: string; onPress: () => void; danger?: boolean }) {
  return (
    <TouchableOpacity style={[styles.button, props.danger && styles.dangerButton]} onPress={props.onPress}>
      <Text style={styles.buttonText}>{props.label}</Text>
    </TouchableOpacity>
  );
}

function Metric(props: { label: string; value: number }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{props.label}</Text>
      <Text style={styles.metricValue}>{props.value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f3f6f1" },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", color: "#15351f" },
  subtitle: { color: "#50735b", marginTop: 2 },
  tabs: { flexDirection: "row", paddingHorizontal: 12, gap: 8, marginBottom: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 14, backgroundColor: "#e1eadf", alignItems: "center" },
  tabActive: { backgroundColor: "#15351f" },
  tabText: { fontWeight: "700", color: "#15351f" },
  tabTextActive: { color: "white" },
  body: { flex: 1 },
  content: { padding: 14, paddingBottom: 32 },
  status: { color: "#385143", marginBottom: 12, lineHeight: 20 },
  card: { backgroundColor: "white", borderRadius: 18, padding: 16, marginBottom: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 10, color: "#15351f" },
  label: { fontSize: 13, fontWeight: "700", color: "#385143", marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: "#f3f6f1", borderRadius: 12, padding: 12, fontSize: 16 },
  smallInput: { backgroundColor: "#f3f6f1", borderRadius: 10, padding: 10, minWidth: 78, textAlign: "center" },
  clubRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 5 },
  clubName: { flex: 1, fontWeight: "700" },
  muted: { color: "#5f7566", lineHeight: 20, marginTop: 6 },
  bigText: { fontSize: 20, fontWeight: "800", color: "#15351f" },
  pill: { alignSelf: "flex-start", backgroundColor: "#dbead8", paddingVertical: 9, paddingHorizontal: 14, borderRadius: 999 },
  pillText: { fontWeight: "800", color: "#15351f" },
  dropdownButton: {
  alignSelf: "stretch",
  backgroundColor: "#dbead8",
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 14,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},

dropdownButtonText: {
  fontWeight: "800",
  color: "#15351f",
  fontSize: 15,
},

dropdownChevron: {
  fontWeight: "900",
  color: "#15351f",
  fontSize: 13,
},

modalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0, 0, 0, 0.35)",
  justifyContent: "center",
  padding: 20,
},

modalCard: {
  backgroundColor: "white",
  borderRadius: 18,
  padding: 16,
},

modalTitle: {
  fontSize: 18,
  fontWeight: "900",
  color: "#15351f",
  marginBottom: 10,
},

optionRow: {
  paddingVertical: 14,
  paddingHorizontal: 12,
  borderRadius: 12,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},

optionRowActive: {
  backgroundColor: "#dbead8",
},

optionText: {
  fontSize: 16,
  fontWeight: "700",
  color: "#15351f",
},

optionTextActive: {
  fontWeight: "900",
},

optionCheck: {
  fontSize: 18,
  fontWeight: "900",
  color: "#15351f",
},
  recommendation: { fontSize: 18, fontWeight: "800", color: "#15351f", lineHeight: 25, marginVertical: 10 },
  factor: { color: "#385143", marginTop: 4 },
  planCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#f3f6f1",
    borderWidth: 1,
    borderColor: "#d7dfd6",
  },
  planCardRecommended: {
    backgroundColor: "#e3f0e2",
    borderColor: "#2f6f3d",
  },
  planTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#15351f",
  },
  planClub: {
    marginTop: 6,
    fontSize: 15,
    fontWeight: "700",
    color: "#2f6f3d",
  },
  rowGap: { flexDirection: "row", gap: 10, marginTop: 12, flexWrap: "wrap" },
  button: { backgroundColor: "#2f6f3d", paddingVertical: 12, paddingHorizontal: 14, borderRadius: 13, alignItems: "center", marginTop: 10 },
  dangerButton: { backgroundColor: "#963c3c" },
  buttonText: { color: "white", fontWeight: "800" },
  metric: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#d7dfd6" },
  metricLabel: { color: "#385143", fontWeight: "700" },
  metricValue: { color: "#15351f", fontWeight: "900" },
}); 
