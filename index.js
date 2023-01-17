const { Converter } = require("piconvert");

const converter = new Converter()
  .import("ai")
  .export("svg");

converter.run("./ai", "./dest");