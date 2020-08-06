Matter = require('matter-js');
require('matter-wrap');
var { MatterCollisionEvents } = require('matter-collision-events');
Matter.use('matter-wrap', MatterCollisionEvents);

var { jStat } = require('jstat')
Matter._seed = 2;
Math.random = Matter.Common.random;
jStat._random_fn = Matter.Common.random;

var assert = require('assert');
// module aliases
let _Viva = require('vivagraphjs');
var ContactGraph = new _Viva.Graph.graph();

var Location = require('./location.js');
var Pathogen = require('./pathogen.js');
var Cohort = require('./cohort.js');
var EventQueue = require('./event_queue.js');

var Agent = require('./agent.js');

let colormap = require('colormap')
let colors = colormap( {
    colormap: 'chlorophyll',
    nshades: 9,
    format: 'hex',
    alpha: 1
});

let pathogen_colors = colormap({
    colormap: 'portland',
    nshades: 15,
    format: 'hex',
    alpha: 1
})

let interpolate = require('color-interpolate');
let pathogen_color_range = interpolate(['white']);


var AgentStates = {
    SUSCEPTIBLE: 0,
    EXPOSED: 1,
    A_INFECTED: 2,
    S_INFECTED: 3,
    RECOVERED: 4,
    size: 5
};

var Engine = Matter.Engine,
    Render = Matter.Render,
    World = Matter.World,
    Body = Matter.Body,
    Bodies = Matter.Bodies;
    Bounds = Matter.Bounds;
    Mouse = Matter.Mouse;
    MouseConstraint = Matter.MouseConstraint;
    Events = Matter.Events;


var default_simulation_params = {
    sim_time_per_day:2000,
    agent_size: 2,
    link_lifetime: 4000,
    pathogen_mut_prob: 0.1
};

var default_infection_params = {
    per_contact_infection: 0.5, 

    incubation_period_mu: 5,
    incubation_period_sigma: 3,
    
    infectious_period_mu: 7,
    infectious_period_sigma: 4,
    fraction_asymptomatic: 0.2,
    
    asymptomatic_infectious_period_mu: 1.5,
    asymptomatic_infectious_period_sigma: 1.5,

    fraction_seek_care: 0.5,
    fraction_isolate: 0.2,
    time_to_seek_care: 2.5,
    movement_scale: 0.2,
    use_pathogen_contagiousness: false
};

var default_simulation_colors = {
    viva_colors: [0x8B008Bff, 0x00FF00ff, 0xFFFF00ff, 0xFFA500ff, 0x0000FFff, 0xA9A9A9ff, 0xFF00FFff, 0x00CED1ff,0x98FB98ff, 0xCD853Fff],
    matter_colors: ["darkmagenta", "lime", "yellow", "orange", "blue", "darkgrey", "fuchsia", "darkturquoise", "palegreen", "peru"]
}

function InfectiousMatter(div_name, run_headless, simulation_params, infection_params, simulation_colors) {   
    this.simulation_params = Matter.Common.extend(default_simulation_params, simulation_params);
    this.infection_params = Matter.Common.extend(default_infection_params, infection_params);
    this.simulation_colors = Matter.Common.extend(default_simulation_colors, simulation_colors);
    this.matter_world = World.create() 
    this.headless = run_headless || false;
    this.pathogen_color_range = pathogen_color_range;

    this.matter_engine = Engine.create({
      positionIterations: 15, 
      velocityIterations: 15,
      constraintIterations: 10
    });

    this.matter_engine.world.gravity.y = 0.00;
    this.event_queue = new EventQueue();

    if (!this.headless) {
      let _div = document.getElementById(div_name);

        this.matter_render = Render.create({
            element: _div,
            engine: this.matter_engine,
            options: {
                height: _div.offsetHeight,
                width: _div.offsetWidth,
                background: 'rgba(229,229,229)',
                wireframes: false
            }
        });

        var mouse = Mouse.create(this.matter_render.canvas);
        
        this.mouseConstraint = MouseConstraint.create(this.matter_engine, {
            mouse: mouse,
            constraint: {
                stiffness: 0.1,
                render: {
                    visible: true
                }
            }
        });
        
        mouse.element.removeEventListener("mousewheel", mouse.mousewheel);
        mouse.element.removeEventListener("DOMMouseScroll", mouse.mousewheel);
        this.matter_render.mouse = mouse;  
        World.add(this.matter_engine.world, this.mouseConstraint);
        
        Render.run(this.matter_render);
        Engine.run(this.matter_engine);

    }
}

InfectiousMatter.prototype.run_headless = function(timelimit) {
	timelimit = timelimit || 30;

	if(this.run_headless) {
        for(let t=0; t<timelimit*this.simulation_params.sim_time_per_day; t++) {
			//console.log("updating " + this.cur_sim_time);
			//console.log(this.state_counts);
	        this.event_queue.run_events_fired(this.cur_sim_time, 500);

            let temp_agent = Matter.Common.choose(this.agents);

            //console.log(temp_agent.body.position);

            Engine.update(this.matter_engine, 1000 / 60);
            this.cur_sim_time = this.matter_engine.timing.timestamp;
        }
	}
}


InfectiousMatter.prototype.setup_matter_env = function() {
    ContactGraph.clear();
    this.locations = [];
    this.agents = [];
    this.cohorts = [];
    this.cur_sim_time = 0;
    this.state_counts = [];
    this.matter_engine.timing.timestamp = 0;

    for (let i=0; i<AgentStates.size; i++){
        this.state_counts.push(0);
    }

    
    //Engine.run(this.matter_engine);
    //Render.run(this.matter_render);

    if(!this.headless) {
	    Events.on(this.matter_render, "beforeRender", (e) => {
	        this.cur_sim_time = e.timestamp;
	        this.event_queue.run_events_fired(this.cur_sim_time, 500);
	    });

	    Events.on(this.matter_render, "afterRender", (e) => {
	        let ctx = this.matter_render.context;
	        
	        if(ctx) {
	            //todo: refactor to callback?
	            for (let i=0; i< this.locations.length; i++) {
	                this.locations[i].draw_borders(ctx);
	            } 
	        }
	    });
    }

    this.add_event({time: 100, callback: this.pulse_orgs_event(), recurring:true})


};

InfectiousMatter.prototype.update_org_state = function(org, new_state) {
    let old_state = org.agent_object.state;
    org.agent_object.state = new_state;
    if( typeof old_state !== 'undefined') this.state_counts[old_state] -= 1;
    
    this.state_counts[new_state] += 1;

    org.render.lineWidth = 2;
    let stroke_color = org.render.strokeStyle;
    let viva_node_color;

    //todo: refactor to callback?
    //refactor to event!
    switch(new_state) {
        case AgentStates.EXPOSED:
            stroke_color = "orange";
            break;
        case AgentStates.S_INFECTED:
            stroke_color = "red";
            viva_node_color = 0xFF0000ff;
            break;
        case AgentStates.A_INFECTED:
            stroke_color = "red";
            viva_node_color = 0xFF0000ff;

            break;
        case AgentStates.RECOVERED:
            stroke_color = "blue";
            viva_node_color = 0xFFFFFFff;
            break;
        case AgentStates.SENSITIVE:
            org.render.lineWidth = 0;
            break;
        };

    if (org.agent_object.pathogen) {        
        org.color = this.pathogen_color_range(org.agent_object.pathogen.color_float);
        org.render.fillStyle = org.color;
        stroke_color = "black";
        
    }

    org.render.strokeStyle = stroke_color;

    return org;
    //viva_graphics.getNodeUI(org.agent_object.node.id).color = viva_node_color;
};

InfectiousMatter.prototype.add_location = function(name, location_properties) {
    let new_location = new Location(name);
    new_location.border_color = location_properties.border_color;
    new_location.set_bounds(location_properties.bounds);
    new_location.friction = location_properties.friction;
    new_location.type = location_properties.type || 'none';

    new_location.home_color = this.simulation_colors.matter_colors[this.locations.length];
    new_location.viva_node_color = this.simulation_colors.viva_colors[this.locations.length];

    this.locations.push(new_location);
    return new_location;
};

InfectiousMatter.prototype.add_cohort = function() {
    let new_cohort = new Cohort();
    this.cohorts.push(new_cohort);
    return new_cohort;
};

InfectiousMatter.prototype.assign_cohort = function(org, cohort) {
    cohort.add_agent(org.agent_object);
};

InfectiousMatter.prototype.expose_org = function(org, eventual_infected_state, infecting_agent) {
    if (infecting_agent && infecting_agent.pathogen){ 
        org.agent_object.pathogen = infecting_agent.pathogen.get_offspring(this.simulation_params.pathogen_mut_prob);
    } else {
        org.agent_object.pathogen = new Pathogen(0.5, 'root');
    }
    this.update_org_state(org, AgentStates.EXPOSED);
    if (this.post_infection_callback) this.post_infection_callback(org.agent_object, infecting_agent);


    this.add_event( {

        time: Math.max(jStat.normal.sample(this.infection_params.incubation_period_mu, this.infection_params.incubation_period_sigma), 1)*this.simulation_params.sim_time_per_day,
        callback: () => {
            this.update_org_state(org, eventual_infected_state);
            let days_to_recover = 0;
            if (eventual_infected_state == AgentStates.A_INFECTED) {
                //
                days_to_recover = Math.max(jStat.normal.sample(this.infection_params.asymptomatic_infectious_period_mu, this.infection_params.asymptomatic_infectious_period_sigma), 0.5);
            } else {
                //we're symtomatic!
                days_to_recover = Math.max(jStat.normal.sample(this.infection_params.infectious_period_mu, this.infection_params.infectious_period_sigma), 4);
            }

            this.add_event( {
                time: days_to_recover*this.simulation_params.sim_time_per_day,
                callback: () => {
                    this.update_org_state(org, AgentStates.RECOVERED)
                }
            });
        }
    });


}
InfectiousMatter.prototype.register_infection_callback = function(callback) {
    this.post_infection_callback = callback;
}

InfectiousMatter.prototype.add_agent = function(home_location, agent_state) {
    if( typeof agent_state === 'undefined') {
        agent_state = AgentStates.SUSCEPTIBLE;
    }

    assert(home_location && home_location.get_random_position);

    let loc = home_location.get_random_position();
    let new_agent_body = Bodies.circle(loc.x, loc.y, this.simulation_params.agent_size, {plugin: {wrap: home_location.bounds}});
    new_agent_body.render.fillStyle = home_location.home_color || "black";
    new_agent_body.strokeStyle = "black";
    new_agent_body.lineWidth = 2;

    new_agent_body.agent_object = new Agent(new_agent_body);
    new_agent_body.frictionAir = home_location.friction;
    new_agent_body.friction = 0;
    new_agent_body.restitution = 1.1;
    new_agent_body.node = ContactGraph.addNode(new_agent_body.agent_object.uuid, {something:true});
    new_agent_body.agent_object.home = home_location;

    home_location.add_agent(new_agent_body.agent_object);

    new_agent_body.agent_object.register_interaction_callback( (other_agent) => {
        if ((other_agent.state == AgentStates.S_INFECTED ||
            other_agent.state == AgentStates.A_INFECTED) && 
            new_agent_body.agent_object.state == AgentStates.SUSCEPTIBLE) {
            let per_contact_infection = this.infection_params.per_contact_infection;

            //TODO: Check pathogen per_contact_infection overwrite world wide?
            if (this.infection_params.use_pathogen_contagiousness && other_agent.pathogen) {
                per_contact_infection = other_agent.pathogen.contagiousness;

            }
            if (Matter.Common.random(0, 1) < per_contact_infection) {
                //we're going to infect this org so 
                //now we have to pick which state...
                let future_state;
                if (Matter.Common.random(0,1) < this.infection_params.fraction_asymptomatic) {
                    future_state = AgentStates.A_INFECTED;
                } else {
                    future_state = AgentStates.S_INFECTED;
                }


                this.expose_org(new_agent_body, future_state, other_agent);
                //this.post_infection_callback(new_agent_body.agent_object, other_agent);
            }
        }
        assert(other_agent.uuid && new_agent_body.agent_object.uuid)

        var this_edge = ContactGraph.hasLink(new_agent_body.agent_object.uuid, other_agent.uuid) || ContactGraph.hasLink(other_agent.uuid, new_agent_body.agent_object.uuid);
        if (this_edge){
            this_edge.data.timestamp = this.cur_sim_time;
        } else {
            assert(ContactGraph.hasNode(new_agent_body.agent_object.uuid) && ContactGraph.hasNode(new_agent_body.agent_object.uuid));
            this_edge = ContactGraph.addLink(new_agent_body.agent_object.uuid, other_agent.uuid, {origin:new_agent_body.agent_object.uuid, timestamp:this.cur_sim_time});
        }

        this.add_event( {
            time: this.simulation_params.link_lifetime+1, 
            callback: _check_edge_for_removal(this_edge)
        });

    });

    var _check_edge_for_removal = (edge) => {
        return () => {
            if (edge.data.timestamp < this.cur_sim_time - this.simulation_params.link_lifetime) {
                ContactGraph.removeLink(edge);
            } 
            else {
                this.add_event( {
                    time:(this.cur_sim_time + this.simulation_params.link_lifetime) - edge.data.timestamp,
                    callback: _check_edge_for_removal(edge)
                }); 
            }
        };
    };


    new_agent_body.onCollide( (pair) => {
        if (pair.bodyA === new_agent_body && pair.bodyB.agent_object) {
            pair.bodyA.agent_object.handle_agent_contact(pair.bodyB.agent_object);

        } else if (pair.bodyB === new_agent_body && pair.bodyA.agent_object) {
            pair.bodyB.agent_object.handle_agent_contact(pair.bodyA.agent_object)
        }
    });

    World.add(this.matter_engine.world, new_agent_body);
    this.agents.push(new_agent_body.agent_object);
    this.update_org_state(new_agent_body, agent_state);

    return(new_agent_body);
};

InfectiousMatter.prototype.add_event = function (q_item) {
    assert(q_item.time && q_item.callback);
    this.event_queue.add_event(this.cur_sim_time, q_item);
};

InfectiousMatter.prototype.set_agent_contact_callback = function (callback) {
    this.agent_contact_callback = callback;
};

InfectiousMatter.prototype.clear_simulator = function() {
    //Render.stop(this.matter_render);
    World.clear(this.matter_engine.world);
    Engine.clear(this.matter_engine);
    this.event_queue.clear_events();
    //this.matter_engine.events = {};

    /*
    this.matter_render.canvas.remove();
    this.matter_render.canvas = null;
    this.matter_render.context = null;
    this.matter_render.textures = {};

    this.matter_world = null;
    this.matter_engine = null;
    this.event_queue = null;
    this.matter_render = null;
    this.mouseConstraint = null;
    */
}

InfectiousMatter.prototype.remove_simulator = function() {
    this.clear_simulator();
    Render.stop();

    this.matter_engine.events = {};
    this.matter_render.canvas.remove();
    this.matter_render.canvas = null;
    this.matter_render.context = null;
    this.matter_render.textures = {};

    this.matter_world = null;
    this.matter_engine = null;
    this.event_queue = null;
    this.matter_render = null;
    this.mouseConstraint = null;
}

InfectiousMatter.prototype.pulse_orgs_event = function() {
    return () => {
        for (let i=0; i < 100; i++) {
            let temp_agent = Matter.Common.choose(this.agents);
            Matter.Body.applyForce(temp_agent.body, temp_agent.body.position, {
                x:Matter.Common.random(-2e-5*this.infection_params.movement_scale, 2e-5*this.infection_params.movement_scale),
                y:Matter.Common.random(-2e-5*this.infection_params.movement_scale, 2e-5*this.infection_params.movement_scale)
            });
        }
    };
};

module.exports = { InfectiousMatter, AgentStates, ContactGraph };
