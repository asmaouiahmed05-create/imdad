import assert from "node:assert/strict";
import test from "node:test";
import {
  canEditBom,
  classificationAllowsBomUse,
  classificationCompatibleWithBomReferences,
  getBomStatusTransition,
  isProductClassification,
  isRecordId,
  nextBomRevision,
  snapshotFinishedProduct,
  validateBomComponents,
} from "./production-bom.ts";

test("product classification values and BOM roles are explicit", () => {
  for (const value of [
    "UNCLASSIFIED",
    "MATERIAL",
    "FINISHED_GOOD",
    "BOTH",
  ]) {
    assert.equal(isProductClassification(value), true);
  }
  assert.equal(isProductClassification("RAW_MATERIAL"), false);
  assert.equal(classificationAllowsBomUse("MATERIAL", "material"), true);
  assert.equal(classificationAllowsBomUse("MATERIAL", "finished"), false);
  assert.equal(classificationAllowsBomUse("FINISHED_GOOD", "finished"), true);
  assert.equal(classificationAllowsBomUse("BOTH", "material"), true);
  assert.equal(classificationAllowsBomUse("UNCLASSIFIED", "material"), false);
  assert.equal(
    classificationCompatibleWithBomReferences("BOTH", 2, 3),
    true,
  );
  assert.equal(
    classificationCompatibleWithBomReferences("MATERIAL", 1, 0),
    false,
  );
  assert.equal(
    classificationCompatibleWithBomReferences("FINISHED_GOOD", 0, 1),
    false,
  );
  assert.equal(
    classificationCompatibleWithBomReferences("BOTH", 0, 0),
    true,
  );
  assert.equal(
    classificationCompatibleWithBomReferences("MATERIAL", 0, 2),
    true,
  );
  assert.equal(
    classificationCompatibleWithBomReferences("FINISHED_GOOD", 3, 0),
    true,
  );
  assert.equal(
    classificationCompatibleWithBomReferences("UNCLASSIFIED", 1, 0),
    false,
  );
});

test("released BOM product identity is a value snapshot", () => {
  const product = { name: "Chair", sku: "CHAIR-1", unit: "piece" };
  const releasedSnapshot = snapshotFinishedProduct(product);
  product.name = "Renamed chair";
  product.sku = "CHAIR-2";
  product.unit = "set";
  assert.deepEqual(releasedSnapshot, {
    finishedProductName: "Chair",
    finishedProductSku: "CHAIR-1",
    finishedProductUnit: "piece",
  });
});

test("BOM component validation requires positive amounts and distinct products", () => {
  assert.deepEqual(
    validateBomComponents(
      [
        { materialProductId: "material-1", quantityPerUnit: "2.125" },
        { materialProductId: "material-2", quantityPerUnit: ".5" },
      ],
      "finished-1",
    ),
    {
      ok: true,
      components: [
        { materialProductId: "material-1", quantityPerUnit: 2.125 },
        { materialProductId: "material-2", quantityPerUnit: 0.5 },
      ],
    },
  );

  for (const quantityPerUnit of ["", "0", "-1", "1.1234567", "1item"]) {
    assert.equal(
      validateBomComponents(
        [{ materialProductId: "material-1", quantityPerUnit }],
        "finished-1",
      ).ok,
      false,
      String(quantityPerUnit),
    );
  }
});

test("BOM component validation rejects invalid relationships and IDs", () => {
  assert.equal(isRecordId("valid-123"), true);
  assert.equal(isRecordId("../invalid"), false);
  assert.equal(
    validateBomComponents(
      [{ materialProductId: "finished-1", quantityPerUnit: "1" }],
      "finished-1",
    ).ok,
    false,
  );
  assert.equal(
    validateBomComponents(
      [
        { materialProductId: "material-1", quantityPerUnit: "1" },
        { materialProductId: "material-1", quantityPerUnit: "2" },
      ],
      "finished-1",
    ).ok,
    false,
  );
  assert.equal(validateBomComponents([], "finished-1").ok, false);
});

test("BOM drafts are editable while released and retired revisions are immutable", () => {
  assert.equal(canEditBom("DRAFT"), true);
  assert.equal(canEditBom("RELEASED"), false);
  assert.equal(canEditBom("RETIRED"), false);
  assert.equal(getBomStatusTransition("DRAFT", "release"), "RELEASED");
  assert.equal(getBomStatusTransition("RELEASED", "retire"), "RETIRED");
  assert.equal(getBomStatusTransition("RELEASED", "release"), null);
  assert.equal(getBomStatusTransition("RETIRED", "retire"), null);
});

test("BOM revisions increase monotonically and reject invalid maxima", () => {
  assert.equal(nextBomRevision(null), 1);
  assert.equal(nextBomRevision(1), 2);
  assert.throws(() => nextBomRevision(0), RangeError);
  assert.throws(() => nextBomRevision(Number.MAX_SAFE_INTEGER + 1), RangeError);
  assert.throws(() => nextBomRevision(2_147_483_647), RangeError);
});
