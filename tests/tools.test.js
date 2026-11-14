const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { emptyModel, createPlannerTools } = require("../itinerary.js");

function toolsFor(model, hooks) {
  const list = createPlannerTools(model, hooks);
  return Object.fromEntries(
    list.map(function (tool) {
      return [tool.name, tool];
    })
  );
}

describe("planner tools", function () {
  it("builds a schedule from event and steps", function () {
    const model = emptyModel();
    const tools = toolsFor(model);
    const added = tools["add-event"].execute({ name: "Dinner", time: "7:00 PM" }, {});
    assert.equal(added.error, undefined);
    tools["add-step"].execute({ name: "Brush teeth", minutes: 10 }, {});
    tools["add-step"].execute({ name: "Travel", minutes: "30 minutes" }, {});
    const schedule = tools["get-schedule"].execute({}, {});
    assert.equal(schedule.summary, "Start preparing at 6:20 PM for Dinner.");
    assert.deepEqual(
      schedule.rows.map(function (row) {
        return [row.name, row.start];
      }),
      [
        ["Brush teeth", "6:20 PM"],
        ["Travel", "6:30 PM"],
        ["Dinner", "7:00 PM"],
      ]
    );
    assert.equal(tools["get-schedule"].annotations.readOnlyHint, true);
    assert.equal(tools["add-step"].annotations.readOnlyHint, false);
  });

  it("returns a descriptive error and leaves the model unchanged", function () {
    const model = emptyModel();
    const tools = toolsFor(model);
    const result = tools["add-event"].execute({ name: "Dinner", time: "7:60" }, {});
    assert.match(result.error, /00 to 59/);
    assert.equal(model.eventMinutes, null);
    const step = tools["add-step"].execute({ name: "Travel", minutes: 15 }, {});
    assert.match(step.error, /before adding a step/);
    assert.equal(model.steps.length, 0);
  });

  it("reorders a step without keeping the move mode selected", function () {
    const model = emptyModel();
    const tools = toolsFor(model);
    tools["add-event"].execute({ name: "Dinner", time: "7:00 PM" }, {});
    tools["add-step"].execute({ name: "Brush teeth", minutes: 10 }, {});
    tools["add-step"].execute({ name: "Travel", minutes: 30 }, {});
    const moved = tools["move-step"].execute({ index: 0, direction: "down" }, {});
    assert.equal(moved.rows[0].name, "Travel");
    assert.equal(moved.rows[0].start, "6:20 PM");
    assert.equal(moved.rows[1].start, "6:50 PM");
    assert.equal(model.action, "remove");
  });

  it("stops a cancelled tool before it changes the schedule", function () {
    const model = emptyModel();
    const tools = toolsFor(model);
    assert.throws(function () {
      tools["add-event"].execute(
        { name: "Dinner", time: "7:00 PM" },
        { signal: AbortSignal.abort() }
      );
    });
    assert.equal(model.eventName, "");
  });
});
