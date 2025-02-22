
import * as THREE from './three.module-149.js';
import RAPIER from './rapier3d-compat.js';
import * as utils from './rapier_utils.js'

import {  OrbitControls} from './OrbitControls-149.js';
import { TransformControls } from './TransformControls-149.js';


import { Robot } from './robot-debug.js'

let container;
let spnDebug;

let camera, scene, renderer, controls;
//
let transform_ctrl;
let pointer_target = new THREE.Mesh();

let world;
let eventQueue;
let ground_collider;
let boxes = [];

let robot;
let target_direction = new THREE.Vector3();
let target_rotation = new THREE.Quaternion();

await init();
async function init() {

    container = document.querySelector('body');
    spnDebug = document.getElementById('spnDebug');
    spnDebug.innerHTML  = "debug";

    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);

    let w = 640; //window.visualViewport.width;
    let h = 480; //window.visualViewport.height;
    // console.log("size", w, h, window.innerWidth, window.innerHeight);
    renderer.setSize(w, h);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);


    window.addEventListener('resize', function() {

        let w = 640; //window.visualViewport.width;
        let h = 480; //window.visualViewport.height;

        // console.log("resize", w, h, window.innerWidth, window.innerHeight);

        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);        
        render();
    });


    let canvas = document.querySelector("canvas");
    canvas.className = 'overflow-hidden';

    // sceneSetup();

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);

    camera = new THREE.PerspectiveCamera(70, w / h, 0.1, 100);
    // camera.position.set(2.5, 2.5, 2.5);

    // camera.position.set(0, 1, 1.2);
    camera.position.set(0, 1.5, 2.2);

    scene.add(camera);


    await RAPIER.init();
    let gravity = {x: 0.0, y: -9.81, z: 0.0};
    world = new RAPIER.World(gravity);
    eventQueue = new RAPIER.EventQueue(true);
    let ip = world.integrationParameters;
    ip.erp = 1.0;
    ip.maxStabilizationIterations = 10;

    let groundColliderDesc = RAPIER.ColliderDesc.cuboid(10.0, 1, 10.0);
    groundColliderDesc.setTranslation(0, -1, 0);
    ground_collider = world.createCollider(groundColliderDesc);
    ground_collider.ignore_controller = true;

    robot = new Robot(world, scene);

    robot.base.r.setNextKinematicTranslation({x: 0, y: robot.base.h/2, z: 0}, true);
    world.step(eventQueue);
    robot.base.r.recomputeMassPropertiesFromColliders();
    robot.base.m.add(pointer_target);

    transform_ctrl = new TransformControls(camera, renderer.domElement);
    transform_ctrl.addEventListener('change', render);
    transform_ctrl.addEventListener('dragging-changed', function (event) {
        controls.enabled = ! event.value;
        
    });
    transform_ctrl.size = 0.75
    transform_ctrl.setSpace("local");
    transform_ctrl.attach(pointer_target);

    scene.add(transform_ctrl);

    let size = 0.5
    let p = new THREE.Vector3(0, 1, 0.75);
    let c = new THREE.Color();
    c.setHex(0xffffff * Math.random());
    let box = utils.addBody("dynamic", "cuboid", world, scene, 1, 0, -1, 100, size, size, size, p.x, p.y, p.z, c);
    boxes.push(box);

    size = 0.4
    p.set(0.55, 1, 0.5);
    c.setHex(0xffffff * Math.random());
    let box2 = utils.addBody("dynamic", "cuboid", world, scene, 1, 0, -1, 100, size, size, size, p.x, p.y, p.z, c);
    boxes.push(box2);

    for (let i = 0; i < 100; i++) {
        world.step(eventQueue);
    }

    pointer_target.position.set(0.15, 0.455, 0.5);

    size = 0.05;
    for (let i = 1; i < 5; i++) {
        for (let j = 1; j < 5; j++) {
            let p = new THREE.Vector3(-0.25 + i/10, 1, -0.25 + j/10);
            p.z += 0.75;
            let c = new THREE.Color();
            c.setHex(0xffffff * Math.random());
            let box = utils.addBody("dynamic", "cuboid", world, scene, 1, 0, -1, 0, size, size, size, p.x, p.y, p.z, c);
            box.c.ignore_controller = true;
            boxes.push(box);
        }
    }

//==============================================================================
    scene.add( new THREE.AmbientLight(0xf0f0f0));
    const light = new THREE.SpotLight(0xffffff, 1.5);
    light.position.set(0, 15, 2);
    light.angle = Math.PI * 0.2;
    light.castShadow = true;
    light.shadow.camera.near = 2;
    light.shadow.camera.far = 20;
    light.shadow.bias = - 0.000222;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    scene.add(light);

    const planeGeometry = new THREE.PlaneGeometry(20, 20);
    planeGeometry.rotateX(- Math.PI / 2);
    const planeMaterial = new THREE.ShadowMaterial({ color: 0x000000, opacity: 0.2});

    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.position.y = - 2;
    plane.receiveShadow = true;
    scene.add( plane );

    const helper = new THREE.GridHelper(20, 20);
    helper.material.opacity = 0.25;
    helper.material.transparent = true;
    scene.add( helper );

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.damping = 0.2;
    controls.enableZoom = false;
    controls.addEventListener('change', render);

    renderer.setAnimationLoop(render);

}


function render() {

    for (let i = 0; i < boxes.length; i++) {
        let p = boxes[i].r.translation();
        let q = boxes[i].r.rotation();
        boxes[i].m.position.set(p.x, p.y, p.z);
        boxes[i].m.quaternion.set(q.x, q.y, q.z, q.w);
    }

    robot.setGripperTranslation(pointer_target);

    robot.updateModels();

    robot.resetGripperSensors();
    eventQueue.drainContactForceEvents(event => {
        let d = event.maxForceDirection();
        let dv = new THREE.Vector3(d.x, d.y, d.z);
        let c1 = world.getCollider(event.collider1());
        let c2 = world.getCollider(event.collider2());
        c1.touch = "on";
        c2.touch = "on";
    });
    robot.updateGripperState();

    robot.setPlatformTranslation(target_direction);
    world.step(eventQueue);

    robot.setPlatformRotation(target_rotation);
    robot.setGripperRotation(pointer_target);

    
    renderer.render(scene, camera);
}

window.addEventListener('keyup', function(event) {
    if (event.code == "KeyW" || event.code == "KeyS") {
        target_direction.set(0, 0, 0);    
    }
    if (event.code == "KeyA" || event.code == "KeyD") {
        let R = robot.base.r.rotation();
        target_rotation.set(R.x, R.y, R.z, R.w);
    }
});

window.addEventListener('keydown', function(event) {

    let p = new THREE.Vector3();
    let angle = 0;
    let update_position = false;
    let update_rotation = false;

    switch ( event.code ) {
        case "KeyN":
            robot.saveState();
            break;
        case "KeyM":
            robot.restoreState();
            break;
        case "KeyT":
            transform_ctrl.setMode('translate');
            break;
        case "KeyR":
            transform_ctrl.setMode('rotate');
            break;
        case "KeyZ":
            controls.enableZoom = !controls.enableZoom;
            // world.step(eventQueue);
            break;
        case "KeyG":
            robot.gripper_open = !robot.gripper_open;
            break;
        case "KeyW":
            p.set(0, 0, 0.01);
            update_position = true;
            break;
        case "KeyS":
            p.set(0, 0, -0.01);
            update_position = true;
            break;
        case "KeyA":
            angle = 90;
            update_rotation = true;
            break;
        case "KeyD":
            angle = -90;
            update_rotation = true;
            break;
    }

    if (update_position) {
        target_direction = p;
    }

    if (update_rotation) {
        angle = THREE.MathUtils.degToRad(angle);
        let q = new THREE.Quaternion();
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        q.multiply(robot.base.m.quaternion);
        target_rotation = q;
    }
});



