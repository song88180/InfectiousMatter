const ReactDOM = require("react-dom");
import React, { useState, useRef, useEffect } from 'react';
const Matter = require("matter-js");

function MatterDiv({elementID}){

  const targetElement = useRef(null);

  useEffect(()=>{
    var Engine = Matter.Engine,
      Render = Matter.Render,
      World = Matter.World,
      Bodies = Matter.Bodies,
      Mouse = Matter.Mouse,
      MouseConstraint = Matter.MouseConstraint;
    
    var engine = Engine.create();
    
    var render = Render.create({
      engine: engine,
      element: targetElement.current,
      options: {
        width: 600,
        height: 600,
        wireframes: false
      }
    });

    var ballA = Bodies.circle(210, 100, 30, { restitution: 0.5 });
    var ballB = Bodies.circle(110, 50, 30, { restitution: 0.5 });

    World.add(engine.world, [
      // walls
      Bodies.rectangle(200, 0, 600, 50, { isStatic: true }),
      Bodies.rectangle(200, 600, 600, 50, { isStatic: true }),
      Bodies.rectangle(260, 300, 50, 600, { isStatic: true }),
      Bodies.rectangle(0, 300, 50, 600, { isStatic: true })
    ]);

    World.add(engine.world, [ballA, ballB]);

    Engine.run(engine);

    Render.run(render);
  }, []);
  
  return (<div ref={targetElement} />);
}

export default MatterDiv;
